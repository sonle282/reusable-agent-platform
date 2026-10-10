import type { AgentVersionSnapshot } from "../shared/contracts";
import { assertSafeHttpsUrl } from "./knowledge";
import { decryptCredential } from "./security/crypto";

type ToolTrace = { name: string; input: unknown; output: unknown };
type JsonSchema = { type?: string; required?: string[]; properties?: Record<string, JsonSchema>; items?: JsonSchema };

function validateJsonSchema(schema: JsonSchema, value: unknown, path = "input"): string[] {
  const errors: string[] = [];
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [`${path} must be an object`];
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (record[key] === undefined) errors.push(`${path}.${key} is required`);
    for (const [key, child] of Object.entries(schema.properties ?? {})) if (record[key] !== undefined) errors.push(...validateJsonSchema(child, record[key], `${path}.${key}`));
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) errors.push(`${path} must be an array`);
    else if (schema.items) value.forEach((item, index) => errors.push(...validateJsonSchema(schema.items!, item, `${path}[${index}]`)));
  } else if (schema.type === "string" && typeof value !== "string") errors.push(`${path} must be a string`);
  else if (schema.type === "number" && typeof value !== "number") errors.push(`${path} must be a number`);
  else if (schema.type === "integer" && (!Number.isInteger(value))) errors.push(`${path} must be an integer`);
  else if (schema.type === "boolean" && typeof value !== "boolean") errors.push(`${path} must be a boolean`);
  return errors;
}

const pluginHandlers: Record<string, (input: Record<string, unknown>) => unknown> = {
  normalize_contact: (input) => ({
    name: String(input.name ?? "").trim().replace(/\s+/g, " "),
    phone: String(input.phone ?? "").replace(/[^+\d]/g, ""),
    email: String(input.email ?? "").trim().toLowerCase(),
  }),
  active_at: (input) => {
    const at = new Date(String(input.at ?? new Date().toISOString()));
    const from = input.validFrom ? new Date(String(input.validFrom)) : null;
    const until = input.validUntil ? new Date(String(input.validUntil)) : null;
    return { active: (!from || from <= at) && (!until || until >= at), at: at.toISOString() };
  },
};

export async function searchRecords(env: Env, collectionId: string, query: string, limit = 5) {
  const safeLimit = Math.max(1, Math.min(limit, 20));
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const where = terms.length ? terms.map(() => "LOWER(search_text) LIKE ?").join(" OR ") : "1 = 1";
  const params = terms.map((term) => `%${term.replaceAll("%", "").replaceAll("_", "")}%`);
  // Rank by how many words match, whole phrase first, so a common word ("hàng") can't crowd out the right row.
  const score = terms.length ? `${terms.map(() => "(LOWER(search_text) LIKE ?)").join(" + ")} + 2 * (LOWER(search_text) LIKE ?)` : "0";
  const phrase = terms.length ? [`%${terms.join(" ").replaceAll("%", "").replaceAll("_", "")}%`] : [];
  const result = await env.DB.prepare(`SELECT id, data_json, valid_from, valid_until FROM data_records WHERE collection_id = ? AND status = 'active' AND (valid_from IS NULL OR valid_from <= datetime('now')) AND (valid_until IS NULL OR valid_until >= datetime('now')) AND (${where}) ORDER BY ${score} DESC, updated_at DESC LIMIT ?`)
    .bind(collectionId, ...params, ...params, ...phrase, safeLimit).all<{ id: string; data_json: string; valid_from: string | null; valid_until: string | null }>();
  return result.results.map((row) => ({ id: row.id, ...JSON.parse(row.data_json) as object, record_id: row.id, valid_from: row.valid_from, valid_until: row.valid_until }));
}

export async function getRecord(env: Env, collectionId: string, recordId: string) {
  const row = await env.DB.prepare("SELECT id, data_json, status, valid_from, valid_until FROM data_records WHERE id = ? AND collection_id = ?")
    .bind(recordId, collectionId).first<{ id: string; data_json: string; status: string; valid_from: string | null; valid_until: string | null }>();
  return row ? { id: row.id, ...JSON.parse(row.data_json) as object, status: row.status, valid_from: row.valid_from, valid_until: row.valid_until } : null;
}

export function modelTools(snapshot: AgentVersionSnapshot, externalTools: Array<{ name: string; description: string; input_schema_json: string }>) {
  const collections = snapshot.collectionBindings.map((binding) => ({
    name: binding.toolName,
    description: `${binding.purpose}. Returns only records that are active and currently valid.`,
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 10 } }, required: ["query"] },
  }));
  const external = externalTools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: JSON.parse(tool.input_schema_json) as Record<string, unknown> }));
  return [...collections, ...external];
}

async function executeHttpGet(env: Env, config: Record<string, unknown>, input: Record<string, unknown>) {
  const template = String(config.urlTemplate ?? "");
  const values = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, encodeURIComponent(String(value))]));
  const raw = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => values[key] ?? "");
  const url = assertSafeHttpsUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(Number(config.timeoutMs ?? 8000), 15000));
  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (config.credentialId) {
      const row = await env.DB.prepare("SELECT ciphertext, iv FROM credentials WHERE id = ?").bind(String(config.credentialId)).first<{ ciphertext: string; iv: string }>();
      if (row) {
        headers.authorization = `Bearer ${await decryptCredential(row.ciphertext, row.iv, env.CREDENTIAL_ENCRYPTION_KEY)}`;
      }
    }
    const response = await fetch(url, { method: "GET", headers, redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP tool returned ${response.status}`);
    const body = (await response.text()).slice(0, 100_000);
    try { return JSON.parse(body) as unknown; } catch { return body; }
  } finally { clearTimeout(timer); }
}

export async function executeTool(
  env: Env,
  snapshot: AgentVersionSnapshot,
  toolRows: Array<{ name: string; kind: string; config_json: string; input_schema_json?: string; output_schema_json?: string | null }>,
  name: string,
  input: Record<string, unknown>,
): Promise<{ output: unknown; trace: ToolTrace }> {
  const binding = snapshot.collectionBindings.find((item) => item.toolName === name);
  let output: unknown;
  if (binding) output = await searchRecords(env, binding.collectionId, String(input.query ?? ""), Number(input.limit ?? 5));
  else {
    const tool = toolRows.find((item) => item.name === name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const inputErrors = validateJsonSchema(JSON.parse(tool.input_schema_json ?? "{}") as JsonSchema, input);
    if (inputErrors.length) throw new Error(`Invalid tool input: ${inputErrors.join(", ")}`);
    if (tool.kind === "http_get") output = await executeHttpGet(env, JSON.parse(tool.config_json) as Record<string, unknown>, input);
    else if (tool.kind === "plugin") {
      const config = JSON.parse(tool.config_json) as { pluginId?: string };
      const handler = config.pluginId ? pluginHandlers[config.pluginId] : undefined;
      if (!handler) throw new Error("Unknown read-only code plugin");
      output = handler(input);
    } else throw new Error("Tool is not executable in v1");
    if (tool.output_schema_json) {
      const outputErrors = validateJsonSchema(JSON.parse(tool.output_schema_json) as JsonSchema, output, "output");
      if (outputErrors.length) throw new Error(`Invalid tool output: ${outputErrors.join(", ")}`);
    }
  }
  return { output, trace: { name, input, output } };
}
