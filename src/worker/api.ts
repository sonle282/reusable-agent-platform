import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { agentDraftSchema, anthropicModelSchema, collectionSchema, genericMessageSchema, starterDraft, type AgentResult, type NormalizedMessage } from "../shared/contracts";
import { normalizeZernio, verifyZernio } from "./connectors";
import { getAgent, getConnectionByApiKeyHash, getConnectionByTokenHash, id, parseJson, validateCollectionData, writeAudit, type ConnectionRow } from "./db";
import { assertSafeHttpsUrl, createTextKnowledge, fetchKnowledgeUrl } from "./knowledge";
import { CloudflareAgentRuntime } from "./runtime";
import { generateWithAnthropic } from "./model/anthropic";
import { hasProfile } from "../shared/prompt";
import { executeTool } from "./tools";
import { clearSessionCookies, createSession, requireAdmin, setSessionCookies, type AuthVariables } from "./security/auth";
import { constantTimeEqual, encryptCredential, hashPassword, randomToken, sha256, verifyPassword } from "./security/crypto";

type AppEnv = { Bindings: Env; Variables: AuthVariables };
export const app = new Hono<AppEnv>();

const jsonError = (error: unknown) => ({ error: error instanceof Error ? error.message : "Unexpected error" });
const now = () => new Date().toISOString();

app.onError((error, c) => {
  if (error instanceof z.ZodError) return c.json({ error: "Invalid request", issues: error.issues.slice(0, 20).map((issue) => ({ path: issue.path.join("."), message: issue.message })), request_id: c.get("requestId") }, 400);
  if (/UNIQUE constraint failed/i.test(error.message)) return c.json({ error: "An item with the same identifier already exists", request_id: c.get("requestId") }, 409);
  console.error(JSON.stringify({ level: "error", event: "request_failed", path: c.req.path, message: error.message }));
  return c.json({ error: "Request failed", request_id: c.get("requestId") }, 500);
});

app.use("*", async (c, next) => {
  const requestId = c.req.header("CF-Ray") ?? id("req");
  c.set("requestId" as never, requestId as never);
  c.header("X-Request-Id", requestId);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
  await next();
});

app.get("/health", async (c) => {
  const checks: Record<string, boolean> = { worker: true, d1: false, r2: false, queue: Boolean(c.env.JOBS), durableObject: Boolean(c.env.ConversationAgent), aiSearch: Boolean(c.env.AI_SEARCH), assets: Boolean(c.env.ASSETS) };
  try { checks.d1 = (await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>())?.ok === 1; } catch { checks.d1 = false; }
  try { await c.env.FILES.head("__healthcheck__"); checks.r2 = true; } catch { checks.r2 = false; }
  return c.json({ status: Object.values(checks).every(Boolean) ? "ok" : "degraded", checks, timestamp: now() }, checks.d1 ? 200 : 503);
});

app.get("/api/setup/status", async (c) => {
  const row = await c.env.DB.prepare("SELECT value_json FROM settings WHERE key = 'setup_complete'").first<{ value_json: string }>();
  const brand = await c.env.DB.prepare("SELECT value_json FROM settings WHERE key = 'brand'").first<{ value_json: string }>();
  return c.json({ setupComplete: row?.value_json === "true", brand: parseJson(brand?.value_json, {}) });
});

app.post("/api/setup", async (c) => {
  const body = z.object({
    bootstrapToken: z.string().min(8), email: z.string().email(), password: z.string().min(12),
    brand: z.object({ name: z.string().min(1).max(100), logoUrl: z.string().url().or(z.literal("")), primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), supportUrl: z.string().url().or(z.literal("")) }),
    anthropicApiKey: z.string().min(10).optional(), gatewayId: z.string().min(1).optional(), accountId: z.string().min(1).optional(),
  }).parse(await c.req.json());
  const setup = await c.env.DB.prepare("SELECT value_json FROM settings WHERE key = 'setup_complete'").first<{ value_json: string }>();
  if (setup?.value_json === "true") return c.json({ error: "Setup is already complete" }, 409);
  if (!await constantTimeEqual(body.bootstrapToken, c.env.BOOTSTRAP_TOKEN)) return c.json({ error: "Invalid bootstrap token" }, 401);
  const password = await hashPassword(body.password);
  const adminId = id("admin");
  const statements = [
    c.env.DB.prepare("INSERT INTO admins(id, email, password_hash, password_salt, password_iterations) VALUES(?,?,?,?,?)").bind(adminId, body.email.toLowerCase(), password.hash, password.salt, password.iterations),
    c.env.DB.prepare("UPDATE settings SET value_json = 'true', updated_at = datetime('now') WHERE key = 'setup_complete'"),
    c.env.DB.prepare("UPDATE settings SET value_json = ?, updated_at = datetime('now') WHERE key = 'brand'").bind(JSON.stringify(body.brand)),
  ];
  let credentialId: string | undefined;
  if (body.anthropicApiKey) {
    credentialId = id("cred");
    const encrypted = await encryptCredential(body.anthropicApiKey, c.env.CREDENTIAL_ENCRYPTION_KEY);
    statements.push(c.env.DB.prepare("INSERT INTO credentials(id, label, kind, ciphertext, iv, key_version) VALUES(?,?,'anthropic_api_key',?,?,?)")
      .bind(credentialId, "Anthropic", encrypted.ciphertext, encrypted.iv, encrypted.keyVersion));
  }
  if (body.gatewayId || body.accountId || credentialId) {
    statements.push(c.env.DB.prepare("INSERT OR REPLACE INTO settings(key, value_json, updated_at) VALUES('model_defaults',?,datetime('now'))")
      .bind(JSON.stringify({ credentialId, gatewayId: body.gatewayId, accountId: body.accountId })));
  }
  await c.env.DB.batch(statements);
  const session = await createSession(c.env.DB, adminId, Number(c.env.SESSION_TTL_SECONDS), c.env.SESSION_SIGNING_KEY);
  setSessionCookies(c, session.sessionToken, session.csrfToken, Number(c.env.SESSION_TTL_SECONDS));
  return c.json({ ok: true, csrfToken: session.csrfToken }, 201);
});

app.post("/api/auth/login", async (c) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).parse(await c.req.json());
  const ipKey = await sha256(`${c.req.header("CF-Connecting-IP") ?? "unknown"}:${body.email.toLowerCase()}`);
  const attempts = await c.env.DB.prepare("SELECT attempts, locked_until FROM login_attempts WHERE key_hash = ?").bind(ipKey).first<{ attempts: number; locked_until: string | null }>();
  if (attempts?.locked_until && new Date(attempts.locked_until) > new Date()) return c.json({ error: "Too many attempts. Try again later." }, 429);
  const admin = await c.env.DB.prepare("SELECT id, password_hash, password_salt, password_iterations FROM admins WHERE email = ?")
    .bind(body.email.toLowerCase()).first<{ id: string; password_hash: string; password_salt: string; password_iterations: number }>();
  const valid = admin && await verifyPassword(body.password, admin.password_salt, admin.password_iterations, admin.password_hash);
  if (!valid) {
    const count = (attempts?.attempts ?? 0) + 1;
    const lockedUntil = count >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await c.env.DB.prepare("INSERT INTO login_attempts(key_hash, attempts, locked_until) VALUES(?,?,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=excluded.attempts, locked_until=excluded.locked_until, updated_at=datetime('now')")
      .bind(ipKey, count, lockedUntil).run();
    return c.json({ error: "Invalid email or password" }, 401);
  }
  await c.env.DB.prepare("DELETE FROM login_attempts WHERE key_hash = ?").bind(ipKey).run();
  const session = await createSession(c.env.DB, admin.id, Number(c.env.SESSION_TTL_SECONDS), c.env.SESSION_SIGNING_KEY);
  setSessionCookies(c, session.sessionToken, session.csrfToken, Number(c.env.SESSION_TTL_SECONDS));
  return c.json({ ok: true, csrfToken: session.csrfToken });
});

app.use("/api/admin/*", requireAdmin);

app.get("/api/admin/session", (c) => c.json({ authenticated: true, csrfToken: c.get("csrfToken") }));

app.post("/api/admin/logout", async (c) => {
  const token = getCookie(c, "agent_session");
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256(token)).run();
  clearSessionCookies(c);
  return c.json({ ok: true });
});

app.get("/api/admin/bootstrap", async (c) => {
  const [brand, model, agents, collections, connections] = await Promise.all([
    c.env.DB.prepare("SELECT value_json FROM settings WHERE key='brand'").first<{ value_json: string }>(),
    c.env.DB.prepare("SELECT value_json FROM settings WHERE key='model_defaults'").first<{ value_json: string }>(),
    c.env.DB.prepare("SELECT id,name,description,primary_language,status,active_version_id,updated_at FROM agents ORDER BY updated_at DESC").all(),
    c.env.DB.prepare("SELECT id,name,slug,description,schema_json,updated_at,archived_at FROM data_collections ORDER BY archived_at IS NOT NULL, updated_at DESC").all(),
    c.env.DB.prepare("SELECT id,agent_id,type,name,status,callback_url,config_json,created_at FROM connections ORDER BY created_at DESC").all(),
  ]);
  // Sidebar signals: the draft differs from the live version (or nothing is live) and replies that failed to deliver.
  const first = agents.results[0] as { id: string } | undefined;
  const [drafts, failed] = await Promise.all([
    first
      ? c.env.DB.prepare("SELECT a.draft_json, v.snapshot_json, v.version FROM agents a LEFT JOIN agent_versions v ON v.id=a.active_version_id WHERE a.id=?").bind(first.id).first<{ draft_json: string; snapshot_json: string | null; version: number | null }>()
      : null,
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM deliveries WHERE status='failed'").first<{ count: number }>(),
  ]);
  const unpublished = Boolean(drafts) && (!drafts!.snapshot_json || JSON.stringify(agentDraftSchema.parse(JSON.parse(drafts!.snapshot_json))) !== JSON.stringify(agentDraftSchema.parse(JSON.parse(drafts!.draft_json))));
  return c.json({ brand: parseJson(brand?.value_json, {}), modelDefaults: parseJson(model?.value_json, {}), agents: agents.results, collections: collections.results, connections: connections.results, attention: { unpublished, liveVersion: drafts?.version ?? null, failedDeliveries: failed?.count ?? 0 } });
});

app.patch("/api/admin/settings/brand", async (c) => {
  const brand = z.object({ name: z.string().min(1).max(100), logoUrl: z.string().url().or(z.literal("")), primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i), supportUrl: z.string().url().or(z.literal("")) }).parse(await c.req.json());
  await c.env.DB.prepare("UPDATE settings SET value_json=?, updated_at=datetime('now') WHERE key='brand'").bind(JSON.stringify(brand)).run();
  await writeAudit(c.env.DB, "settings.brand.update", "settings", "brand", c.get("adminId"));
  return c.json(brand);
});

app.post("/api/admin/settings/anthropic", async (c) => {
  const body = z.object({ apiKey: z.string().min(10), gatewayId: z.string().min(1), accountId: z.string().min(1), label: z.string().default("Anthropic") }).parse(await c.req.json());
  const credentialId = id("cred");
  const encrypted = await encryptCredential(body.apiKey, c.env.CREDENTIAL_ENCRYPTION_KEY);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO credentials(id,label,kind,ciphertext,iv,key_version) VALUES(?,?,'anthropic_api_key',?,?,?)").bind(credentialId, body.label, encrypted.ciphertext, encrypted.iv, encrypted.keyVersion),
    c.env.DB.prepare("INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('model_defaults',?,datetime('now'))").bind(JSON.stringify({ credentialId, gatewayId: body.gatewayId, accountId: body.accountId })),
  ]);
  const draftAgents = await c.env.DB.prepare("SELECT id,draft_json FROM agents").all<{ id: string; draft_json: string }>();
  if (draftAgents.results.length) await c.env.DB.batch(draftAgents.results.map((agent) => {
    const draft = agentDraftSchema.parse(JSON.parse(agent.draft_json));
    draft.modelConfig = { ...draft.modelConfig, credentialId, gatewayId: body.gatewayId, accountId: body.accountId };
    return c.env.DB.prepare("UPDATE agents SET draft_json=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(draft), agent.id);
  }));
  return c.json({ credentialId, configured: true }, 201);
});

app.post("/api/admin/settings/anthropic/test", async (c) => {
  const defaults = parseJson((await c.env.DB.prepare("SELECT value_json FROM settings WHERE key='model_defaults'").first<{ value_json: string }>())?.value_json, {} as Record<string, unknown>);
  const body = z.object({ model: anthropicModelSchema.default("claude-haiku-5-5") }).parse(await c.req.json().catch(() => ({})));
  const config = agentDraftSchema.shape.modelConfig.parse({ credentialId: defaults.credentialId, gatewayId: defaults.gatewayId, accountId: defaults.accountId, model: body.model, maxTokens: 256, timeoutMs: 30000 });
  const result = await generateWithAnthropic(c.env, config, "Reply with exactly: connected", [{ role: "user", content: "Connection test" }], [], id("modeltest"));
  return c.json({ connected: Boolean(result.text), model: config.model, response: result.text.slice(0, 100) });
});

app.get("/api/admin/agents", async (c) => c.json((await c.env.DB.prepare("SELECT * FROM agents ORDER BY updated_at DESC").all()).results));

app.post("/api/admin/agents", async (c) => {
  const body = z.object({ name: z.string().min(1).max(120), description: z.string().max(500).default(""), primaryLanguage: z.string().default("en"), template: z.enum(["blank", "sales", "support"]).default("blank"), businessName: z.string().max(200).optional(), offering: z.string().max(2000).optional() }).parse(await c.req.json());
  const defaults = parseJson((await c.env.DB.prepare("SELECT value_json FROM settings WHERE key='model_defaults'").first<{ value_json: string }>())?.value_json, {} as Record<string, unknown>);
  const draft = starterDraft(body.template);
  draft.profile = { ...draft.profile, businessName: body.businessName ?? draft.profile.businessName, offering: body.offering ?? draft.profile.offering };
  draft.modelConfig = agentDraftSchema.shape.modelConfig.parse({ ...draft.modelConfig, credentialId: defaults.credentialId, gatewayId: defaults.gatewayId, accountId: defaults.accountId });
  const agentId = id("agent");
  await c.env.DB.prepare("INSERT INTO agents(id,name,description,primary_language,draft_json) VALUES(?,?,?,?,?)").bind(agentId, body.name, body.description, body.primaryLanguage, JSON.stringify(draft)).run();
  await writeAudit(c.env.DB, "agent.create", "agent", agentId, c.get("adminId"));
  return c.json({ id: agentId, ...body, draft }, 201);
});

app.get("/api/admin/agents/:id", async (c) => {
  const agent = await getAgent(c.env.DB, c.req.param("id"));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  const [versions, sources, tools, evalCases] = await Promise.all([
    c.env.DB.prepare("SELECT id,version,published_at FROM agent_versions WHERE agent_id=? ORDER BY version DESC").bind(agent.id).all(),
    c.env.DB.prepare("SELECT * FROM knowledge_sources WHERE agent_id=? ORDER BY created_at DESC").bind(agent.id).all(),
    c.env.DB.prepare("SELECT id,name,description,kind,config_json,input_schema_json,status FROM tool_definitions WHERE agent_id=?").bind(agent.id).all(),
    c.env.DB.prepare("SELECT * FROM eval_cases WHERE agent_id=?").bind(agent.id).all(),
  ]);
  const draft = agentDraftSchema.parse(JSON.parse(agent.draft_json));
  const live = agent.active_version_id ? await c.env.DB.prepare("SELECT snapshot_json FROM agent_versions WHERE id=?").bind(agent.active_version_id).first<{ snapshot_json: string }>() : null;
  const draftMatchesLive = Boolean(live) && JSON.stringify(agentDraftSchema.parse(JSON.parse(live!.snapshot_json))) === JSON.stringify(draft);
  return c.json({ ...agent, draft, draftMatchesLive, versions: versions.results, sources: sources.results, tools: tools.results, evalCases: evalCases.results });
});

app.patch("/api/admin/agents/:id", async (c) => {
  const body = z.object({ name: z.string().min(1).max(120).optional(), description: z.string().max(500).optional(), primaryLanguage: z.string().optional(), draft: agentDraftSchema.optional() }).parse(await c.req.json());
  const agent = await getAgent(c.env.DB, c.req.param("id"));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  await c.env.DB.prepare("UPDATE agents SET name=?,description=?,primary_language=?,draft_json=?,updated_at=datetime('now') WHERE id=?")
    .bind(body.name ?? agent.name, body.description ?? agent.description, body.primaryLanguage ?? agent.primary_language, JSON.stringify(body.draft ?? JSON.parse(agent.draft_json)), agent.id).run();
  await writeAudit(c.env.DB, "agent.draft.update", "agent", agent.id, c.get("adminId"));
  return c.json({ ok: true });
});

async function validatePublish(env: Env, agentId: string, draft: ReturnType<typeof agentDraftSchema.parse>) {
  const errors: string[] = [];
  if (!draft.instructions.trim() && !hasProfile(draft)) errors.push("Describe the assistant's job in Instructions");
  if (!draft.modelConfig.credentialId) errors.push("Model credential is required");
  if (draft.modelConfig.credentialId && !(await env.DB.prepare("SELECT id FROM credentials WHERE id=?").bind(draft.modelConfig.credentialId).first())) errors.push("Model credential is missing");
  for (const sourceId of draft.knowledgeSourceIds) {
    const source = await env.DB.prepare("SELECT status FROM knowledge_sources WHERE id=? AND agent_id=?").bind(sourceId, agentId).first<{ status: string }>();
    if (source?.status !== "ready") errors.push(`Knowledge source ${sourceId} is not ready`);
  }
  for (const binding of draft.collectionBindings) if (!(await env.DB.prepare("SELECT id FROM data_collections WHERE id=?").bind(binding.collectionId).first())) errors.push(`Collection ${binding.collectionId} is missing`);
  for (const tool of draft.toolBindings) if (!(await env.DB.prepare("SELECT id FROM tool_definitions WHERE agent_id=? AND name=? AND status='active'").bind(agentId, tool).first())) errors.push(`Tool ${tool} is missing`);
  const criticalCount = (await env.DB.prepare("SELECT COUNT(*) AS count FROM eval_cases WHERE agent_id=? AND critical=1").bind(agentId).first<{ count: number }>())?.count ?? 0;
  if (criticalCount > 0) {
    const last = await env.DB.prepare("SELECT status FROM eval_runs WHERE agent_id=? ORDER BY created_at DESC LIMIT 1").bind(agentId).first<{ status: string }>();
    if (last?.status !== "passed") errors.push("Critical evaluations must pass before publishing");
  }
  return errors;
}

app.post("/api/admin/agents/:id/publish", async (c) => {
  const agent = await getAgent(c.env.DB, c.req.param("id"));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  const draft = agentDraftSchema.parse(JSON.parse(agent.draft_json));
  const errors = await validatePublish(c.env, agent.id, draft);
  if (errors.length) return c.json({ error: "Publish validation failed", details: errors }, 422);
  const versionNumber = ((await c.env.DB.prepare("SELECT MAX(version) AS version FROM agent_versions WHERE agent_id=?").bind(agent.id).first<{ version: number | null }>())?.version ?? 0) + 1;
  const versionId = id("ver");
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO agent_versions(id,agent_id,version,snapshot_json) VALUES(?,?,?,?)").bind(versionId, agent.id, versionNumber, JSON.stringify(draft)),
    c.env.DB.prepare("UPDATE agents SET active_version_id=?,status='active',updated_at=datetime('now') WHERE id=?").bind(versionId, agent.id),
  ]);
  await writeAudit(c.env.DB, "agent.publish", "agent", agent.id, c.get("adminId"), { versionId, versionNumber });
  return c.json({ versionId, version: versionNumber, status: "active" }, 201);
});

app.post("/api/admin/agents/:id/rollback/:versionId", async (c) => {
  const version = await c.env.DB.prepare("SELECT id,version FROM agent_versions WHERE id=? AND agent_id=?").bind(c.req.param("versionId"), c.req.param("id")).first<{ id: string; version: number }>();
  if (!version) return c.json({ error: "Version not found" }, 404);
  await c.env.DB.prepare("UPDATE agents SET active_version_id=?,status='active',updated_at=datetime('now') WHERE id=?").bind(version.id, c.req.param("id")).run();
  await writeAudit(c.env.DB, "agent.rollback", "agent", c.req.param("id"), c.get("adminId"), { versionId: version.id });
  return c.json(version);
});

app.post("/api/admin/agents/:id/preview", async (c) => {
  const body = z.object({ text: z.string().min(1).max(20000), conversationId: z.string().optional() }).parse(await c.req.json());
  const agent = await getAgent(c.env.DB, c.req.param("id"));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  const conversationId = body.conversationId ?? crypto.randomUUID();
  const input: NormalizedMessage = { eventId: id("preview"), connectionId: "preview", agentId: agent.id, conversationId, externalUserId: "admin", content: { text: body.text }, customer: { locale: agent.primary_language }, receivedAt: now() };
  const result = await new CloudflareAgentRuntime(c.env).handleMessage(input, { versionId: "draft", snapshotOverride: agentDraftSchema.parse(JSON.parse(agent.draft_json)) });
  return c.json(result);
});

app.post("/api/admin/agents/:id/evaluate", async (c) => {
  const agent = await getAgent(c.env.DB, c.req.param("id"));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  const cases = (await c.env.DB.prepare("SELECT * FROM eval_cases WHERE agent_id=?").bind(agent.id).all<{ id: string; input: string; assertions_json: string; critical: number }>()).results;
  const draft = agentDraftSchema.parse(JSON.parse(agent.draft_json));
  const results = [];
  for (const testCase of cases) {
    const assertions = parseJson(testCase.assertions_json, {} as { mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number; expectedTool?: string });
    const input: NormalizedMessage = { eventId: id("evalevt"), connectionId: "eval", agentId: agent.id, conversationId: crypto.randomUUID(), externalUserId: "eval", content: { text: testCase.input }, receivedAt: now() };
    const output = await new CloudflareAgentRuntime(c.env).handleMessage(input, { versionId: "draft", snapshotOverride: draft });
    const text = output.messages.map((message) => message.text).join("\n");
    const failures = [
      ...(assertions.mustInclude ?? []).filter((needle) => !text.toLowerCase().includes(needle.toLowerCase())).map((needle) => `Missing: ${needle}`),
      ...(assertions.mustNotInclude ?? []).filter((needle) => text.toLowerCase().includes(needle.toLowerCase())).map((needle) => `Forbidden: ${needle}`),
      ...(assertions.maxLength && text.length > assertions.maxLength ? [`Longer than ${assertions.maxLength}`] : []),
      ...(assertions.expectedTool && !output.trace?.toolCalls.some((tool) => tool.name === assertions.expectedTool) ? [`Tool not called: ${assertions.expectedTool}`] : []),
    ];
    results.push({ caseId: testCase.id, passed: failures.length === 0 && output.status === "completed", failures, output });
  }
  const passed = results.every((result) => result.passed);
  const runId = id("eval");
  await c.env.DB.prepare("INSERT INTO eval_runs(id,agent_id,status,result_json,completed_at) VALUES(?,?,?,?,datetime('now'))").bind(runId, agent.id, passed ? "passed" : "failed", JSON.stringify(results)).run();
  return c.json({ id: runId, passed, results });
});

app.post("/api/admin/agents/:id/eval-cases", async (c) => {
  const body = z.object({ name: z.string().min(1), input: z.string().min(1), assertions: z.object({ mustInclude: z.array(z.string()).optional(), mustNotInclude: z.array(z.string()).optional(), maxLength: z.number().int().positive().optional(), expectedTool: z.string().optional() }), critical: z.boolean().default(false) }).parse(await c.req.json());
  const caseId = id("case");
  await c.env.DB.prepare("INSERT INTO eval_cases(id,agent_id,name,input,assertions_json,critical) VALUES(?,?,?,?,?,?)")
    .bind(caseId, c.req.param("id"), body.name, body.input, JSON.stringify(body.assertions), body.critical ? 1 : 0).run();
  return c.json({ id: caseId, ...body }, 201);
});

app.patch("/api/admin/eval-cases/:caseId", async (c) => {
  const body = z.object({ name: z.string().min(1), input: z.string().min(1), assertions: z.object({ mustInclude: z.array(z.string()).optional(), mustNotInclude: z.array(z.string()).optional(), maxLength: z.number().int().positive().optional(), expectedTool: z.string().optional() }), critical: z.boolean() }).parse(await c.req.json());
  const result = await c.env.DB.prepare("UPDATE eval_cases SET name=?,input=?,assertions_json=?,critical=? WHERE id=?").bind(body.name, body.input, JSON.stringify(body.assertions), body.critical ? 1 : 0, c.req.param("caseId")).run();
  if (!result.meta.changes) return c.json({ error: "Scenario not found" }, 404);
  return c.json({ id: c.req.param("caseId"), ...body });
});

app.delete("/api/admin/eval-cases/:caseId", async (c) => {
  await c.env.DB.prepare("DELETE FROM eval_cases WHERE id=?").bind(c.req.param("caseId")).run();
  await writeAudit(c.env.DB, "eval_case.delete", "eval_case", c.req.param("caseId"), c.get("adminId"));
  return c.json({ ok: true });
});

app.post("/api/admin/agents/:id/knowledge/text", async (c) => {
  const body = z.object({ name: z.string().min(1), text: z.string().min(1).max(2_000_000) }).parse(await c.req.json());
  const sourceId = await createTextKnowledge(c.env, c.req.param("id"), body.name, body.text);
  return c.json({ id: sourceId, status: "pending" }, 202);
});

app.post("/api/admin/agents/:id/knowledge/url", async (c) => {
  const body = z.object({ name: z.string().min(1), url: z.string().url() }).parse(await c.req.json());
  await fetchKnowledgeUrl(body.url);
  const sourceId = id("ks");
  await c.env.DB.prepare("INSERT INTO knowledge_sources(id,agent_id,type,name,source_url) VALUES(?,?,'url',?,?)").bind(sourceId, c.req.param("id"), body.name, body.url).run();
  await c.env.JOBS.send({ kind: "knowledge_ingest", sourceId });
  return c.json({ id: sourceId, status: "pending" }, 202);
});

app.post("/api/admin/agents/:id/tools", async (c) => {
  const body = z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), description: z.string().min(1).max(500),
    kind: z.enum(["http_get", "plugin"]), urlTemplate: z.string().optional(), pluginId: z.enum(["normalize_contact", "active_at"]).optional(),
    inputSchema: z.record(z.string(), z.unknown()), outputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
    timeoutMs: z.number().int().min(500).max(15000).default(8000), cacheSeconds: z.number().int().min(0).max(86400).default(0), authToken: z.string().optional(),
  }).parse(await c.req.json());
  if (body.kind === "http_get" && !body.urlTemplate) return c.json({ error: "GET URL template is required" }, 422);
  if (body.kind === "plugin" && !body.pluginId) return c.json({ error: "Plugin ID is required" }, 422);
  if (body.urlTemplate) assertSafeHttpsUrl(body.urlTemplate.replace(/\{[a-zA-Z0-9_]+\}/g, "test"));
  let credentialId: string | undefined;
  const statements: D1PreparedStatement[] = [];
  if (body.authToken) {
    credentialId = id("cred");
    const encrypted = await encryptCredential(body.authToken, c.env.CREDENTIAL_ENCRYPTION_KEY);
    statements.push(c.env.DB.prepare("INSERT INTO credentials(id,label,kind,ciphertext,iv,key_version) VALUES(?,?,'http_bearer',?,?,?)")
      .bind(credentialId, `${body.name} token`, encrypted.ciphertext, encrypted.iv, encrypted.keyVersion));
  }
  const toolId = id("tool");
  const config = body.kind === "http_get" ? { urlTemplate: body.urlTemplate, timeoutMs: body.timeoutMs, cacheSeconds: body.cacheSeconds, credentialId } : { pluginId: body.pluginId };
  statements.push(c.env.DB.prepare("INSERT INTO tool_definitions(id,agent_id,name,description,kind,config_json,input_schema_json,output_schema_json) VALUES(?,?,?,?,?,?,?,?)")
    .bind(toolId, c.req.param("id"), body.name, body.description, body.kind, JSON.stringify(config), JSON.stringify(body.inputSchema), body.outputSchema ? JSON.stringify(body.outputSchema) : null));
  await c.env.DB.batch(statements);
  return c.json({ id: toolId, name: body.name, kind: body.kind }, 201);
});

app.post("/api/admin/tools/:id/test", async (c) => {
  const body = z.object({ input: z.record(z.string(), z.unknown()).default({}) }).parse(await c.req.json());
  const tool = await c.env.DB.prepare("SELECT * FROM tool_definitions WHERE id=?").bind(c.req.param("id")).first<{ name: string; agent_id: string; kind: string; config_json: string; input_schema_json: string; output_schema_json: string | null }>();
  if (!tool) return c.json({ error: "Tool not found" }, 404);
  const agent = await getAgent(c.env.DB, tool.agent_id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  const output = await executeTool(c.env, agentDraftSchema.parse(JSON.parse(agent.draft_json)), [tool], tool.name, body.input);
  return c.json(output);
});

app.patch("/api/admin/knowledge/:id", async (c) => {
  const body = z.object({ name: z.string().min(1).max(200).optional(), text: z.string().min(1).max(2_000_000).optional() }).parse(await c.req.json());
  const source = await c.env.DB.prepare("SELECT id,type,name,r2_key FROM knowledge_sources WHERE id=?").bind(c.req.param("id")).first<{ id: string; type: string; name: string; r2_key: string | null }>();
  if (!source) return c.json({ error: "Source not found" }, 404);
  if (body.text !== undefined) {
    if (source.type === "url" || !source.r2_key) return c.json({ error: "Web page sources are refreshed from their URL" }, 422);
    await c.env.FILES.put(source.r2_key, body.text, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
  }
  // Titles are read from D1 at retrieval time, so only new text needs re-indexing.
  const reindex = body.text !== undefined;
  await c.env.DB.prepare(`UPDATE knowledge_sources SET name=?,${reindex ? "status='pending',error=NULL," : ""}updated_at=datetime('now') WHERE id=?`).bind(body.name ?? source.name, source.id).run();
  if (reindex) await c.env.JOBS.send({ kind: "knowledge_ingest", sourceId: source.id });
  await writeAudit(c.env.DB, "knowledge.update", "knowledge_source", source.id, c.get("adminId"));
  return c.json({ id: source.id, status: reindex ? "pending" : "unchanged" });
});

app.get("/api/admin/knowledge/:id/content", async (c) => {
  const source = await c.env.DB.prepare("SELECT r2_key FROM knowledge_sources WHERE id=?").bind(c.req.param("id")).first<{ r2_key: string | null }>();
  if (!source?.r2_key) return c.json({ text: "" });
  const object = await c.env.FILES.get(source.r2_key);
  return c.json({ text: object ? await object.text() : "" });
});

app.post("/api/admin/knowledge/:id/retry", async (c) => {
  await c.env.DB.prepare("UPDATE knowledge_sources SET status='pending',error=NULL,updated_at=datetime('now') WHERE id=?").bind(c.req.param("id")).run();
  await c.env.JOBS.send({ kind: "knowledge_ingest", sourceId: c.req.param("id") });
  return c.json({ status: "pending" }, 202);
});

app.get("/api/admin/collections", async (c) => c.json((await c.env.DB.prepare("SELECT * FROM data_collections ORDER BY updated_at DESC").all()).results));

app.post("/api/admin/collections", async (c) => {
  const body = z.object({ name: z.string().min(1), slug: z.string().regex(/^[a-z][a-z0-9_-]*$/), description: z.string().default(""), schema: collectionSchema }).parse(await c.req.json());
  const collectionId = id("col");
  await c.env.DB.prepare("INSERT INTO data_collections(id,name,slug,description,schema_json) VALUES(?,?,?,?,?)").bind(collectionId, body.name, body.slug, body.description, JSON.stringify(body.schema)).run();
  return c.json({ id: collectionId, ...body }, 201);
});

app.get("/api/admin/collections/:id/records", async (c) => c.json((await c.env.DB.prepare("SELECT * FROM data_records WHERE collection_id=? ORDER BY updated_at DESC LIMIT 500").bind(c.req.param("id")).all()).results));

app.post("/api/admin/collections/:id/records", async (c) => {
  const body = z.object({ data: z.record(z.string(), z.unknown()), externalKey: z.string().optional(), status: z.enum(["draft", "active", "archived"]).default("active"), validFrom: z.string().nullable().optional(), validUntil: z.string().nullable().optional() }).parse(await c.req.json());
  const collection = await c.env.DB.prepare("SELECT schema_json FROM data_collections WHERE id=?").bind(c.req.param("id")).first<{ schema_json: string }>();
  if (!collection) return c.json({ error: "Collection not found" }, 404);
  const validated = validateCollectionData(collection.schema_json, body.data);
  if (validated.errors.length) return c.json({ error: "Validation failed", details: validated.errors }, 422);
  const recordId = id("rec");
  await c.env.DB.prepare("INSERT INTO data_records(id,collection_id,external_key,data_json,search_text,status,valid_from,valid_until) VALUES(?,?,?,?,?,?,?,?)")
    .bind(recordId, c.req.param("id"), body.externalKey ?? null, JSON.stringify(validated.data), Object.values(validated.data).join(" ").toLowerCase(), body.status, body.validFrom ?? null, body.validUntil ?? null).run();
  return c.json({ id: recordId, data: validated.data }, 201);
});

app.patch("/api/admin/collections/:id/records/:recordId", async (c) => {
  const body = z.object({ data: z.record(z.string(), z.unknown()).optional(), status: z.enum(["draft", "active", "archived"]).optional(), validFrom: z.string().nullable().optional(), validUntil: z.string().nullable().optional() }).parse(await c.req.json());
  const record = await c.env.DB.prepare("SELECT r.data_json,r.status,r.valid_from,r.valid_until,d.schema_json FROM data_records r JOIN data_collections d ON d.id=r.collection_id WHERE r.id=? AND r.collection_id=?")
    .bind(c.req.param("recordId"), c.req.param("id")).first<{ data_json: string; status: string; valid_from: string | null; valid_until: string | null; schema_json: string }>();
  if (!record) return c.json({ error: "Record not found" }, 404);
  const validated = validateCollectionData(record.schema_json, body.data ?? JSON.parse(record.data_json));
  if (validated.errors.length) return c.json({ error: "Validation failed", details: validated.errors }, 422);
  await c.env.DB.prepare("UPDATE data_records SET data_json=?,search_text=?,status=?,valid_from=?,valid_until=?,updated_at=datetime('now') WHERE id=?")
    .bind(JSON.stringify(validated.data), Object.values(validated.data).join(" ").toLowerCase(), body.status ?? record.status, body.validFrom === undefined ? record.valid_from : body.validFrom || null, body.validUntil === undefined ? record.valid_until : body.validUntil || null, c.req.param("recordId")).run();
  await writeAudit(c.env.DB, "record.update", "data_record", c.req.param("recordId"), c.get("adminId"));
  return c.json({ id: c.req.param("recordId"), data: validated.data });
});

// Renames only: field keys and types stay fixed so tools, imports and stored records keep working.
app.patch("/api/admin/collections/:id", async (c) => {
  const body = z.object({ name: z.string().min(1).max(120).optional(), labels: z.record(z.string(), z.string().min(1).max(120)).default({}), archived: z.boolean().optional() }).parse(await c.req.json());
  const collection = await c.env.DB.prepare("SELECT name,schema_json FROM data_collections WHERE id=?").bind(c.req.param("id")).first<{ name: string; schema_json: string }>();
  if (!collection) return c.json({ error: "Collection not found" }, 404);
  if (body.archived) {
    const inUse = await c.env.DB.prepare("SELECT a.id FROM agents a LEFT JOIN agent_versions v ON v.id=a.active_version_id WHERE instr(a.draft_json, ?) > 0 OR instr(COALESCE(v.snapshot_json,''), ?) > 0 LIMIT 1")
      .bind(`"collectionId":"${c.req.param("id")}"`, `"collectionId":"${c.req.param("id")}"`).first();
    if (inUse) return c.json({ error: "The assistant uses this table. Turn it off in Assistant → Sources and publish first." }, 409);
  }
  const schema = collectionSchema.parse(JSON.parse(collection.schema_json));
  schema.fields = schema.fields.map((field) => ({ ...field, label: body.labels[field.key] ?? field.label }));
  await c.env.DB.prepare(`UPDATE data_collections SET name=?,schema_json=?,${body.archived === undefined ? "" : body.archived ? "archived_at=datetime('now')," : "archived_at=NULL,"}updated_at=datetime('now') WHERE id=?`).bind(body.name ?? collection.name, JSON.stringify(schema), c.req.param("id")).run();
  return c.json({ id: c.req.param("id"), name: body.name ?? collection.name, schema });
});

app.post("/api/admin/collections/:id/import", async (c) => {
  const body = z.object({ rows: z.array(z.record(z.string(), z.unknown())).max(5000), mapping: z.record(z.string(), z.string()).default({}), uniqueKey: z.string().optional(), validFromField: z.string().optional(), validUntilField: z.string().optional(), statusField: z.string().optional() }).parse(await c.req.json());
  const collection = await c.env.DB.prepare("SELECT schema_json FROM data_collections WHERE id=?").bind(c.req.param("id")).first<{ schema_json: string }>();
  if (!collection) return c.json({ error: "Collection not found" }, 404);
  const prepared = body.rows.map((row, index) => {
    const mapped = Object.fromEntries(Object.entries(body.mapping).map(([column, field]) => [field, row[column]]));
    const result = validateCollectionData(collection.schema_json, Object.keys(body.mapping).length ? mapped : row);
    return { index, ...result };
  });
  const errors = prepared.filter((row) => row.errors.length).map((row) => ({ row: row.index + 1, errors: row.errors }));
  if (errors.length) return c.json({ error: "Import validation failed; no rows were imported", details: errors }, 422);
  const statements = prepared.map((row) => {
    const externalKey = body.uniqueKey ? String(row.data[body.uniqueKey] ?? "") : null;
    const source = body.rows[row.index];
    const statusValue = body.statusField ? String(source[body.statusField] ?? "").toLowerCase() : "";
    const status = ["khong", "false", "0", "archived", "inactive"].includes(statusValue) ? "archived" : "active";
    const validFrom = body.validFromField ? String(source[body.validFromField] ?? "") || null : null;
    const validUntil = body.validUntilField ? String(source[body.validUntilField] ?? "") || null : null;
    return c.env.DB.prepare(`INSERT INTO data_records(id,collection_id,external_key,data_json,search_text,status,valid_from,valid_until) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(collection_id,external_key) DO UPDATE SET data_json=excluded.data_json,search_text=excluded.search_text,status=excluded.status,valid_from=excluded.valid_from,valid_until=excluded.valid_until,updated_at=datetime('now')`)
      .bind(id("rec"), c.req.param("id"), externalKey || null, JSON.stringify(row.data), Object.values(row.data).join(" ").toLowerCase(), status, validFrom, validUntil);
  });
  for (let start = 0; start < statements.length; start += 100) await c.env.DB.batch(statements.slice(start, start + 100));
  return c.json({ imported: prepared.length });
});

app.get("/api/admin/connections", async (c) => c.json((await c.env.DB.prepare("SELECT id,agent_id,type,name,status,callback_url,config_json,created_at FROM connections ORDER BY created_at DESC").all()).results));

app.post("/api/admin/connections", async (c) => {
  const body = z.object({ agentId: z.string(), type: z.enum(["generic_api", "generic_webhook", "zernio"]), name: z.string().min(1), callbackUrl: z.string().url().nullable().optional(), config: z.record(z.string(), z.unknown()).default({}), apiCredential: z.string().optional(), webhookSecret: z.string().optional() }).parse(await c.req.json());
  if (!await getAgent(c.env.DB, body.agentId)) return c.json({ error: "Agent not found" }, 404);
  if (body.callbackUrl) assertSafeHttpsUrl(body.callbackUrl);
  if (body.config.inboxApiUrl) assertSafeHttpsUrl(String(body.config.inboxApiUrl));
  const connectionId = id("conn");
  const connectionToken = randomToken(24);
  const apiKey = randomToken(32);
  let credentialId: string | null = null;
  const config = { ...body.config };
  const statements: D1PreparedStatement[] = [];
  if (body.apiCredential) {
    credentialId = id("cred");
    const encrypted = await encryptCredential(body.apiCredential, c.env.CREDENTIAL_ENCRYPTION_KEY);
    statements.push(c.env.DB.prepare("INSERT INTO credentials(id,label,kind,ciphertext,iv,key_version) VALUES(?,?,?, ?,?,?)").bind(credentialId, `${body.name} API`, `${body.type}_api_key`, encrypted.ciphertext, encrypted.iv, encrypted.keyVersion));
  }
  if (body.webhookSecret) {
    const secretId = id("cred");
    const encrypted = await encryptCredential(body.webhookSecret, c.env.CREDENTIAL_ENCRYPTION_KEY);
    statements.push(c.env.DB.prepare("INSERT INTO credentials(id,label,kind,ciphertext,iv,key_version) VALUES(?,?,?, ?,?,?)").bind(secretId, `${body.name} webhook`, `${body.type}_webhook_secret`, encrypted.ciphertext, encrypted.iv, encrypted.keyVersion));
    config.webhookSecretCredentialId = secretId;
  }
  statements.push(c.env.DB.prepare("INSERT INTO connections(id,agent_id,type,name,status,token_hash,api_key_hash,callback_url,config_json,credential_id) VALUES(?,?,?,?,'draft',?,?,?,?,?)")
    .bind(connectionId, body.agentId, body.type, body.name, await sha256(connectionToken), await sha256(apiKey), body.callbackUrl ?? null, JSON.stringify(config), credentialId));
  await c.env.DB.batch(statements);
  return c.json({ id: connectionId, status: "draft", apiKey, webhookToken: connectionToken, webhookPath: `/api/v1/webhooks/${body.type === "zernio" ? "zernio" : "generic"}/${connectionToken}` }, 201);
});

app.post("/api/admin/connections/:id/activate", async (c) => {
  const connection = await c.env.DB.prepare("SELECT * FROM connections WHERE id=?").bind(c.req.param("id")).first<ConnectionRow>();
  if (!connection) return c.json({ error: "Connection not found" }, 404);
  const agent = await getAgent(c.env.DB, connection.agent_id);
  if (!agent?.active_version_id) return c.json({ error: "Publish the agent before activating this connection" }, 422);
  if (connection.type === "zernio") {
    const config = parseJson(connection.config_json, {} as Record<string, unknown>);
    if (!connection.credential_id || !config.webhookSecretCredentialId || !config.inboxApiUrl) return c.json({ error: "Zernio API URL, API credential, and webhook secret are required" }, 422);
  }
  await c.env.DB.prepare("UPDATE connections SET status='active',updated_at=datetime('now') WHERE id=?").bind(connection.id).run();
  return c.json({ id: connection.id, status: "active" });
});

app.post("/api/admin/connections/:id/rotate", async (c) => {
  const connection = await c.env.DB.prepare("SELECT id FROM connections WHERE id=?").bind(c.req.param("id")).first();
  if (!connection) return c.json({ error: "Connection not found" }, 404);
  const apiKey = randomToken(32);
  const webhookToken = randomToken(24);
  await c.env.DB.prepare("UPDATE connections SET api_key_hash=?,token_hash=?,updated_at=datetime('now') WHERE id=?").bind(await sha256(apiKey), await sha256(webhookToken), c.req.param("id")).run();
  return c.json({ apiKey, webhookToken });
});

app.get("/api/admin/conversations", async (c) => {
  const query = c.req.query("q")?.trim();
  const tests = c.req.query("tests") === "1" ? "" : "AND c.connection_id NOT IN ('preview','eval')";
  const result = query
    ? await c.env.DB.prepare(`SELECT c.*,ct.display_name,ct.phone,ct.email FROM conversations c LEFT JOIN contacts ct ON ct.id=c.contact_id WHERE (c.external_user_id LIKE ? OR ct.display_name LIKE ? OR ct.phone LIKE ?) ${tests} ORDER BY c.last_activity_at DESC LIMIT 200`).bind(`%${query}%`, `%${query}%`, `%${query}%`).all()
    : await c.env.DB.prepare(`SELECT c.*,ct.display_name,ct.phone,ct.email FROM conversations c LEFT JOIN contacts ct ON ct.id=c.contact_id WHERE 1=1 ${tests} ORDER BY c.last_activity_at DESC LIMIT 200`).all();
  return c.json(result.results);
});

app.get("/api/admin/conversations/:id", async (c) => {
  const conversation = await c.env.DB.prepare("SELECT c.*,ct.display_name,ct.phone,ct.email,ct.custom_json FROM conversations c LEFT JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=?").bind(c.req.param("id")).first<{ id: string; agent_id: string; connection_id: string; external_conversation_id: string } & Record<string, unknown>>();
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);
  const events = await c.env.DB.prepare("SELECT * FROM runtime_events WHERE conversation_id=? ORDER BY created_at DESC LIMIT 100").bind(c.req.param("id")).all();
  const stub = c.env.ConversationAgent.getByName(`${conversation.agent_id}:${conversation.connection_id}:${conversation.external_conversation_id}`) as unknown as { getTranscript(): Promise<Array<{ id: string; role: string; content: string; created_at: string }>> };
  const messages = await stub.getTranscript();
  return c.json({ conversation, messages, events: events.results });
});

app.post("/api/admin/conversations/:id/takeover", async (c) => {
  const body = z.object({ enabled: z.boolean() }).parse(await c.req.json());
  const conversation = await c.env.DB.prepare("SELECT * FROM conversations WHERE id=?").bind(c.req.param("id")).first<{ id: string; agent_id: string; connection_id: string; external_conversation_id: string }>();
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);
  await c.env.DB.prepare("UPDATE conversations SET human_takeover=?,stage=?,last_activity_at=datetime('now') WHERE id=?").bind(body.enabled ? 1 : 0, body.enabled ? "human_handoff" : "engaged", conversation.id).run();
  const stub = c.env.ConversationAgent.getByName(`${conversation.agent_id}:${conversation.connection_id}:${conversation.external_conversation_id}`) as unknown as { setHumanTakeover(enabled: boolean): Promise<void> };
  await stub.setHumanTakeover(body.enabled);
  return c.json({ enabled: body.enabled });
});

app.get("/api/admin/dashboard", async (c) => {
  const real = "connection_id NOT IN ('preview','eval')";
  const [today, waiting, failed, week] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS count FROM conversations WHERE ${real} AND last_activity_at >= datetime('now','-1 day')`).first<{ count: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS count FROM conversations WHERE ${real} AND human_takeover=1`).first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM deliveries WHERE status='failed'").first<{ count: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS count FROM conversations WHERE ${real} AND last_activity_at >= datetime('now','-7 day')`).first<{ count: number }>(),
  ]);
  return c.json({ chats24h: today?.count ?? 0, waitingForTeam: waiting?.count ?? 0, failedDeliveries: failed?.count ?? 0, chats7d: week?.count ?? 0 });
});

app.get("/api/admin/deliveries", async (c) => c.json((await c.env.DB.prepare("SELECT * FROM deliveries ORDER BY updated_at DESC LIMIT 200").all()).results));

app.post("/api/admin/deliveries/:id/retry", async (c) => {
  const delivery = await c.env.DB.prepare("SELECT d.*,i.result_json FROM deliveries d LEFT JOIN idempotency_events i ON i.connection_id=d.connection_id AND i.event_id=d.request_id WHERE d.id=?")
    .bind(c.req.param("id")).first<{ id: string; connection_id: string; request_id: string; result_json: string | null }>();
  if (!delivery?.result_json) return c.json({ error: "Delivery or result not found" }, 404);
  await c.env.DB.prepare("UPDATE deliveries SET status='pending',updated_at=datetime('now') WHERE id=?").bind(delivery.id).run();
  await c.env.JOBS.send({ kind: "delivery", deliveryId: delivery.id, result: JSON.parse(delivery.result_json) as AgentResult, connectionId: delivery.connection_id, attempt: 0 });
  return c.json({ status: "pending" }, 202);
});

app.get("/api/admin/export", async (c) => {
  const [settings, agents, versions, collections, records, sources, tools, evalCases] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM settings WHERE key != 'model_defaults'").all(), c.env.DB.prepare("SELECT * FROM agents").all(),
    c.env.DB.prepare("SELECT * FROM agent_versions").all(), c.env.DB.prepare("SELECT * FROM data_collections").all(),
    c.env.DB.prepare("SELECT * FROM data_records").all(), c.env.DB.prepare("SELECT id,agent_id,type,name,status,source_url,created_at FROM knowledge_sources").all(),
    c.env.DB.prepare("SELECT id,agent_id,name,description,kind,config_json,input_schema_json,output_schema_json,status FROM tool_definitions").all(),
    c.env.DB.prepare("SELECT * FROM eval_cases").all(),
  ]);
  c.header("Content-Disposition", `attachment; filename=agent-platform-export-${new Date().toISOString().slice(0, 10)}.json`);
  return c.json({ formatVersion: 1, exportedAt: now(), settings: settings.results, agents: agents.results, versions: versions.results, collections: collections.results, records: records.results, sources: sources.results, tools: tools.results, evalCases: evalCases.results });
});

// Client-facing shape; traces, tool output and version IDs stay internal, including on idempotent replays.
function publicMessageResult(result: AgentResult) {
  return { request_id: result.requestId, conversation_id: result.conversationId, messages: result.messages, status: result.status };
}

app.post("/api/v1/messages", async (c) => {
  const bearer = c.req.header("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return c.json({ error: "Missing API key" }, 401);
  const connection = await getConnectionByApiKeyHash(c.env.DB, await sha256(bearer));
  if (!connection || connection.type !== "generic_api") return c.json({ error: "Invalid API key" }, 401);
  const bucket = Math.floor(Date.now() / 60_000);
  const rate = await c.env.DB.prepare(`INSERT INTO api_rate_limits(key_hash,window_start,count) VALUES(?,?,1)
    ON CONFLICT(key_hash,window_start) DO UPDATE SET count=count+1 RETURNING count`).bind(await sha256(bearer), bucket).first<{ count: number }>();
  if ((rate?.count ?? 1) > 60) return c.json({ error: "Rate limit exceeded" }, 429);
  const body = genericMessageSchema.parse(await c.req.json());
  if (body.callback_url && body.callback_url !== connection.callback_url) return c.json({ error: "Callback URL is not allowlisted for this connection" }, 403);
  const eventId = c.req.header("Idempotency-Key") ?? id("request");
  const input: NormalizedMessage = {
    eventId, connectionId: connection.id, agentId: connection.agent_id, conversationId: body.conversation_id,
    externalUserId: body.user_id, content: {
      text: body.message.text,
      images: body.message.attachments.filter((item) => ["image/jpeg", "image/png", "image/webp"].includes(item.mimeType)),
      textFiles: body.message.attachments.filter((item) => ["text/plain", "text/markdown"].includes(item.mimeType)),
    }, customer: body.customer, receivedAt: now(),
  };
  const inserted = await c.env.DB.prepare("INSERT OR IGNORE INTO idempotency_events(event_id,connection_id,status,expires_at) VALUES(?,?,'accepted',datetime('now','+7 day'))").bind(eventId, connection.id).run();
  if (!inserted.meta.changes) {
    const existing = await c.env.DB.prepare("SELECT status,result_json FROM idempotency_events WHERE event_id=? AND connection_id=?").bind(eventId, connection.id).first<{ status: string; result_json: string | null }>();
    return c.json(existing?.result_json ? publicMessageResult(JSON.parse(existing.result_json) as AgentResult) : { request_id: eventId, status: existing?.status ?? "accepted" }, existing?.result_json ? 200 : 202);
  }
  if (body.response_mode === "async") {
    await c.env.JOBS.send({ kind: "message", requestId: eventId, input, callbackUrl: connection.callback_url ?? undefined });
    return c.json({ request_id: eventId, status: "accepted" }, 202);
  }
  const result = await new CloudflareAgentRuntime(c.env).handleMessage(input);
  await c.env.DB.prepare("UPDATE idempotency_events SET status=?,result_json=? WHERE event_id=? AND connection_id=?").bind(result.status, JSON.stringify(result), eventId, connection.id).run();
  return c.json(publicMessageResult(result));
});

app.post("/api/v1/webhooks/:adapter/:token", async (c) => {
  const connection = await getConnectionByTokenHash(c.env.DB, await sha256(c.req.param("token")));
  if (!connection) return c.json({ error: "Connection not found" }, 404);
  const rawBody = await c.req.text();
  let input: NormalizedMessage;
  if (c.req.param("adapter") === "zernio" && connection.type === "zernio") {
    const signature = c.req.header("X-Zernio-Signature") ?? "";
    if (!await verifyZernio(c.env, rawBody, signature, connection)) return c.json({ error: "Invalid signature" }, 401);
    input = normalizeZernio(JSON.parse(rawBody) as Record<string, unknown>, connection, c.req.header("X-Zernio-Event-Id"));
  } else if (c.req.param("adapter") === "generic" && connection.type === "generic_webhook") {
    const signature = c.req.header("X-Webhook-Signature") ?? "";
    if (!await verifyZernio(c.env, rawBody, signature, connection)) return c.json({ error: "Invalid signature" }, 401);
    const body = genericMessageSchema.parse(JSON.parse(rawBody));
    input = { eventId: c.req.header("Idempotency-Key") ?? id("webhook"), connectionId: connection.id, agentId: connection.agent_id, conversationId: body.conversation_id, externalUserId: body.user_id, content: { text: body.message.text, images: body.message.attachments.filter((a) => a.mimeType.startsWith("image/")), textFiles: body.message.attachments.filter((a) => a.mimeType === "text/plain" || a.mimeType === "text/markdown") }, customer: body.customer, receivedAt: now() };
  } else return c.json({ error: "Adapter does not match connection" }, 404);
  const inserted = await c.env.DB.prepare("INSERT OR IGNORE INTO idempotency_events(event_id,connection_id,status,expires_at) VALUES(?,?,'accepted',datetime('now','+7 day'))").bind(input.eventId, connection.id).run();
  if (inserted.meta.changes) await c.env.JOBS.send({ kind: "message", requestId: input.eventId, input });
  return c.json({ request_id: input.eventId, status: inserted.meta.changes ? "accepted" : "duplicate" }, 202);
});
