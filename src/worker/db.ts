import { collectionSchema, parseVersionSnapshot, type AgentVersionSnapshot } from "../shared/contracts";

export type AgentRow = {
  id: string; name: string; description: string; primary_language: string; status: string;
  active_version_id: string | null; draft_json: string; created_at: string; updated_at: string;
};

export type ConnectionRow = {
  id: string; agent_id: string; type: "generic_api" | "generic_webhook" | "zernio";
  name: string; status: string; token_hash: string; api_key_hash: string | null;
  callback_url: string | null; config_json: string; credential_id: string | null;
};

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export async function getAgent(db: D1Database, agentId: string) {
  return db.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first<AgentRow>();
}

export async function getVersionSnapshot(db: D1Database, versionId: string): Promise<AgentVersionSnapshot | null> {
  const row = await db.prepare("SELECT snapshot_json FROM agent_versions WHERE id = ?").bind(versionId).first<{ snapshot_json: string }>();
  return row ? parseVersionSnapshot(JSON.parse(row.snapshot_json)) : null;
}

export async function getRuntimeSnapshot(db: D1Database, agentId: string, versionId?: string) {
  const agent = await getAgent(db, agentId);
  if (!agent) throw new Error("Agent not found");
  const selectedVersion = versionId ?? agent.active_version_id;
  if (!selectedVersion) throw new Error("Agent is not published");
  const snapshot = await getVersionSnapshot(db, selectedVersion);
  if (!snapshot) throw new Error("Agent version not found");
  return { agent, snapshot, versionId: selectedVersion };
}

export async function getConnectionByTokenHash(db: D1Database, tokenHash: string) {
  return db.prepare("SELECT * FROM connections WHERE token_hash = ? AND status = 'active'").bind(tokenHash).first<ConnectionRow>();
}

export async function getConnectionByApiKeyHash(db: D1Database, apiKeyHash: string) {
  return db.prepare("SELECT * FROM connections WHERE api_key_hash = ? AND status = 'active'").bind(apiKeyHash).first<ConnectionRow>();
}

export function validateCollectionData(schemaJson: string, input: Record<string, unknown>) {
  const schema = collectionSchema.parse(JSON.parse(schemaJson));
  const output: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const field of schema.fields) {
    const value = input[field.key];
    if ((value === undefined || value === null || value === "") && field.required) {
      errors.push(`${field.label} is required`);
      continue;
    }
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "number" && !Number.isFinite(Number(value))) errors.push(`${field.label} must be a number`);
    else if (field.type === "boolean" && ![true, false, "true", "false", 0, 1, "0", "1"].includes(value as never)) errors.push(`${field.label} must be boolean`);
    else if ((field.type === "url" || field.type === "image_url") && !URL.canParse(String(value))) errors.push(`${field.label} must be a URL`);
    else if (field.type === "enum" && field.options && !field.options.includes(String(value))) errors.push(`${field.label} has an invalid option`);
    output[field.key] = field.type === "number" ? Number(value) : value;
  }
  return { data: output, errors };
}

export async function writeAudit(db: D1Database, action: string, resourceType: string, resourceId?: string, actorId?: string, metadata: unknown = {}) {
  await db.prepare("INSERT INTO audit_logs(id, actor_id, action, resource_type, resource_id, metadata_json) VALUES(?,?,?,?,?,?)")
    .bind(id("audit"), actorId ?? null, action, resourceType, resourceId ?? null, JSON.stringify(metadata)).run();
}

