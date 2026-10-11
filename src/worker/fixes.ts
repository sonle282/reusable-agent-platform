import type { Hono } from "hono";
import { z } from "zod";
import { agentDraftSchema, type AgentVersionSnapshot, type NormalizedMessage } from "../shared/contracts";
import { channelParts } from "../shared/channel-parts";
import { fallbackChecks } from "../shared/checks";
import { maskContact } from "../shared/mask";
import { getAgent, id, parseJson, validateCollectionData, writeAudit } from "./db";
import { generateWithAnthropic } from "./model/anthropic";
import { CloudflareAgentRuntime } from "./runtime";
import type { AuthVariables } from "./security/auth";

type AppEnv = { Bindings: Env; Variables: AuthVariables };
type Assertions = { criteria?: string; mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number; expectedTool?: string; fromFix?: string };
type TestCase = { id: string; input: string; assertions_json: string; critical?: number };
type RuleSection = "alwaysDo" | "neverDo" | "handoffWhen";

const nowIso = () => new Date().toISOString();

// One scenario against the draft; shared by "Run all", Publish and Fix this answer.
export async function runCase(env: Env, agentId: string, draft: AgentVersionSnapshot, testCase: TestCase) {
  const assertions = parseJson(testCase.assertions_json, {} as Assertions);
  const input: NormalizedMessage = { eventId: id("evalevt"), connectionId: "eval", agentId, conversationId: crypto.randomUUID(), externalUserId: "eval", content: { text: testCase.input }, receivedAt: nowIso() };
  const output = await new CloudflareAgentRuntime(env).handleMessage(input, { versionId: "draft", snapshotOverride: draft });
  const text = output.messages.map((message) => message.text).join("\n");
  const failures = [
    ...(assertions.mustInclude ?? []).filter((needle) => !text.toLowerCase().includes(needle.toLowerCase())).map((needle) => `Missing: ${needle}`),
    ...(assertions.mustNotInclude ?? []).filter((needle) => text.toLowerCase().includes(needle.toLowerCase())).map((needle) => `Forbidden: ${needle}`),
    ...(assertions.maxLength && text.length > assertions.maxLength ? [`Longer than ${assertions.maxLength}`] : []),
    ...(assertions.expectedTool && !output.trace?.toolCalls.some((tool) => tool.name === assertions.expectedTool) ? [`Tool not called: ${assertions.expectedTool}`] : []),
  ];
  if (output.status !== "completed") failures.unshift("The assistant couldn't answer");
  else if (assertions.criteria?.trim()) {
    const verdict = await judge(env, draft, testCase.input, readableReply(text), assertions.criteria.trim());
    if (verdict.checked === false) failures.push(`Not checked: ${verdict.reason}`);
    else if (!verdict.pass) failures.push(`Didn't meet: ${verdict.reason}`);
  }
  return { caseId: testCase.id, passed: failures.length === 0 && output.status === "completed", failures, output, text };
}

// What a customer would read, so the judge never grades the structured payload or its meta.
const readableReply = (text: string) =>
  channelParts(text)
    .map((part) => (part.kind === "text" ? part.text : `[image ${part.url}]`))
    .join("\n");

// "Pass when…" in the owner's words, judged by the model. A judge that can't answer is "Not checked" and blocks Publish.
export async function judge(env: Env, draft: AgentVersionSnapshot, question: string, reply: string, criteria: string): Promise<{ checked: boolean; pass: boolean; reason: string }> {
  if (!draft.modelConfig.credentialId) return { checked: false, pass: false, reason: "no AI key" };
  const system = `You check one reply from a business's customer assistant against the owner's requirement.
Judge only what the requirement asks; ignore style unless it asks about style. Paraphrases and translations count.
Reply with JSON only: {"pass": true|false, "reason": "one short sentence in the requirement's language"}`;
  const user = `Requirement: ${criteria}\n\nCustomer asked: ${question}\n\nAssistant replied: ${reply}`;
  try {
    const result = await generateWithAnthropic(env, { ...draft.modelConfig, maxTokens: 300, temperature: 0, timeoutMs: 30_000 }, system, [{ role: "user", content: user }], [], id("judge"));
    const json = result.text.match(/\{[\s\S]*\}/)?.[0];
    const verdict = json ? (JSON.parse(json) as { pass?: unknown; reason?: unknown }) : null;
    if (!verdict || typeof verdict.pass !== "boolean") return { checked: false, pass: false, reason: "the AI gave no verdict" };
    return { checked: true, pass: verdict.pass, reason: clip(String(verdict.reason ?? ""), 200) };
  } catch {
    return { checked: false, pass: false, reason: "the AI didn't respond" };
  }
}

// ---------- Suggestion ----------

type DataCandidate = { collectionId: string; collectionName: string; toolName: string; recordId: string; title: string; fields: Array<{ key: string; label: string; type: string }>; data: Record<string, unknown> };

export type Suggestion = {
  recommended: "data" | "knowledge" | "rule";
  reason: string;
  name: string;
  checks: { mustInclude: string[]; mustNotInclude: string[] };
  data: null | { collectionId: string; collectionName: string; toolName: string; recordId: string; recordTitle: string; field: string; fieldLabel: string; before: string; after: string };
  knowledge: { question: string; answer: string };
  rule: { section: RuleSection; line: string };
  aiError?: string;
};

const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

function fallbackSuggestion(question: string, correct: string, bad: string): Suggestion {
  return {
    recommended: "knowledge",
    reason: "Saved as a corrected answer so the assistant gives these facts next time.",
    name: clip(`Answer: ${question}`, 80),
    checks: fallbackChecks(correct, bad),
    data: null,
    knowledge: { question, answer: correct },
    rule: { section: "alwaysDo", line: clip(`When a customer asks “${clip(question, 120)}”, say: ${correct}`, 400) },
  };
}

async function loadCandidates(env: Env, draft: AgentVersionSnapshot, lookups: Array<{ toolName: string; recordId: string }>) {
  const candidates: DataCandidate[] = [];
  for (const lookup of lookups) {
    const binding = draft.collectionBindings.find((item) => item.toolName === lookup.toolName);
    if (!binding || candidates.some((item) => item.recordId === lookup.recordId)) continue;
    const row = await env.DB.prepare("SELECT r.id,r.data_json,d.name,d.schema_json FROM data_records r JOIN data_collections d ON d.id=r.collection_id WHERE r.id=? AND r.collection_id=?")
      .bind(lookup.recordId, binding.collectionId)
      .first<{ id: string; data_json: string; name: string; schema_json: string }>();
    if (!row) continue;
    const fields = (parseJson(row.schema_json, { fields: [] as Array<{ key: string; label: string; type: string; required?: boolean }> }).fields ?? []).filter((field) => ["text", "long_text", "number"].includes(field.type));
    const data = parseJson(row.data_json, {} as Record<string, unknown>);
    const titleKey = fields.find((field) => field.type === "text")?.key;
    candidates.push({ collectionId: binding.collectionId, collectionName: row.name, toolName: binding.toolName, recordId: row.id, title: String((titleKey && data[titleKey]) || "Row"), fields: fields.map(({ key, label, type }) => ({ key, label, type })), data });
  }
  return candidates.slice(0, 6);
}

async function suggest(env: Env, draft: AgentVersionSnapshot, question: string, bad: string, correct: string, candidates: DataCandidate[]): Promise<Suggestion> {
  const fallback = fallbackSuggestion(question, correct, bad);
  if (!draft.modelConfig.credentialId) return { ...fallback, aiError: "no_key" };
  const rows = candidates.map((item, index) => `Row ${index + 1} (recordId ${item.recordId}) in table "${item.collectionName}": ${JSON.stringify(Object.fromEntries(item.fields.map((field) => [field.key, item.data[field.key] ?? ""])))}`).join("\n");
  const system = `You help a small-business owner fix one wrong answer from their customer assistant. Decide where the correct fact belongs and propose the smallest change.
Places:
- "data": a looked-up data row holds a wrong or incomplete value (prices, offers, stock). Only possible when rows are listed. Change exactly one field of one listed row.
- "knowledge": a stable fact or policy answer; saved as a corrected question and answer.
- "rule": a behaviour rule for every conversation (always / never / hand off to a person).
Also give 1-2 short exact phrases (numbers, prices, product names) that a correct reply must contain, copied from the owner's answer, and a short scenario name.
Reply with JSON only:
{"recommended":"data|knowledge|rule","reason":"one plain sentence for the owner","name":"short name","mustInclude":["..."],"mustNotInclude":[],"data":{"recordId":"...","field":"...","value":"..."} or null,"rule":{"section":"alwaysDo|neverDo|handoffWhen","line":"..."},"answer":"the corrected answer, tidied but with the same facts"}`;
  const user = `Customer asked: ${question}\n\nAssistant replied: ${bad}\n\nOwner says it should have said: ${correct}\n\nLooked-up rows:\n${rows || "(none)"}`;
  try {
    const result = await generateWithAnthropic(env, { ...draft.modelConfig, maxTokens: 900, temperature: 0, timeoutMs: 30_000 }, system, [{ role: "user", content: user }], [], id("fixsuggest"));
    const json = result.text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error("No JSON in suggestion");
    const raw = JSON.parse(json) as {
      recommended?: string; reason?: string; name?: string; mustInclude?: unknown; mustNotInclude?: unknown;
      data?: { recordId?: string; field?: string; value?: unknown } | null; rule?: { section?: string; line?: string }; answer?: string;
    };
    const candidate = raw.data ? candidates.find((item) => item.recordId === raw.data?.recordId) : undefined;
    const field = candidate?.fields.find((item) => item.key === raw.data?.field);
    const data = candidate && field && raw.data?.value !== undefined
      ? { collectionId: candidate.collectionId, collectionName: candidate.collectionName, toolName: candidate.toolName, recordId: candidate.recordId, recordTitle: candidate.title, field: field.key, fieldLabel: field.label, before: String(candidate.data[field.key] ?? ""), after: String(raw.data.value) }
      : null;
    const phrases = (value: unknown) => (Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter((item) => item && item.length <= 60 && correct.toLowerCase().includes(item.toLowerCase())).slice(0, 2) : []);
    const mustInclude = phrases(raw.mustInclude);
    const section = (["alwaysDo", "neverDo", "handoffWhen"] as const).find((item) => item === raw.rule?.section) ?? "alwaysDo";
    const recommended = raw.recommended === "data" && data ? "data" : raw.recommended === "rule" ? "rule" : "knowledge";
    return {
      recommended,
      reason: clip(String(raw.reason || fallback.reason), 300),
      name: clip(String(raw.name || fallback.name), 80),
      checks: { mustInclude: mustInclude.length ? mustInclude : fallback.checks.mustInclude, mustNotInclude: Array.isArray(raw.mustNotInclude) ? raw.mustNotInclude.map(String).filter((item) => item && item.length <= 60).slice(0, 2) : [] },
      data,
      knowledge: { question, answer: clip(String(raw.answer || correct), 4000) },
      rule: { section, line: clip(String(raw.rule?.line || fallback.rule.line), 400) },
    };
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", event: "fix_suggest_failed", message: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    return { ...fallback, aiError: "failed" };
  }
}

// ---------- Applying a change (and undoing it when the scenario fails) ----------

const changeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("data"), collectionId: z.string(), recordId: z.string(), field: z.string(), value: z.string().max(8000), toolName: z.string().optional() }),
  z.object({ kind: z.literal("knowledge"), question: z.string().min(1).max(4000), answer: z.string().min(1).max(4000) }),
  z.object({ kind: z.literal("rule"), section: z.enum(["alwaysDo", "neverDo", "handoffWhen"]), line: z.string().min(1).max(400) }),
]);
type Change = z.infer<typeof changeSchema>;

async function saveDraft(env: Env, agentId: string, draft: AgentVersionSnapshot) {
  await env.DB.prepare("UPDATE agents SET draft_json=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(draft), agentId).run();
}

async function applyChange(env: Env, agentId: string, fixId: string, change: Change): Promise<{ revert: () => Promise<void>; draft: AgentVersionSnapshot; detail: Record<string, unknown> }> {
  const agent = await getAgent(env.DB, agentId);
  if (!agent) throw new Error("The assistant no longer exists");
  const draft = agentDraftSchema.parse(JSON.parse(agent.draft_json));
  if (change.kind === "data") {
    const record = await env.DB.prepare("SELECT r.data_json,d.schema_json FROM data_records r JOIN data_collections d ON d.id=r.collection_id WHERE r.id=? AND r.collection_id=?")
      .bind(change.recordId, change.collectionId)
      .first<{ data_json: string; schema_json: string }>();
    if (!record) throw new Error("the data row was deleted");
    const before = parseJson(record.data_json, {} as Record<string, unknown>);
    const fieldType = parseJson(record.schema_json, { fields: [] as Array<{ key: string; type: string }> }).fields.find((field) => field.key === change.field)?.type;
    const value = fieldType === "number" ? Number(change.value.replace(/[^\d.-]/g, "")) : change.value;
    const validated = validateCollectionData(record.schema_json, { ...before, [change.field]: value });
    if (validated.errors.length) throw new Error(`the new value doesn't fit the table (${validated.errors[0]})`);
    const write = (data: Record<string, unknown>) =>
      env.DB.prepare("UPDATE data_records SET data_json=?,search_text=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(data), Object.values(data).join(" ").toLowerCase(), change.recordId).run();
    await write(validated.data);
    return { draft, detail: { before: before[change.field] ?? null, after: validated.data[change.field] }, revert: async () => void (await write(before)) };
  }
  if (change.kind === "knowledge") {
    draft.correctedAnswers = [...draft.correctedAnswers.filter((item) => item.fixId !== fixId), { question: change.question, answer: change.answer, fixId }];
  } else {
    draft.profile = { ...draft.profile, [change.section]: [...(draft.profile[change.section] ?? []), change.line] };
  }
  await saveDraft(env, agentId, draft);
  return {
    draft,
    detail: {},
    revert: async () => {
      const current = await getAgent(env.DB, agentId);
      if (!current) return;
      const latest = agentDraftSchema.parse(JSON.parse(current.draft_json));
      if (change.kind === "knowledge") latest.correctedAnswers = latest.correctedAnswers.filter((item) => item.fixId !== fixId);
      else {
        const lines = [...(latest.profile[change.section] ?? [])];
        const index = lines.lastIndexOf(change.line);
        if (index >= 0) lines.splice(index, 1);
        latest.profile = { ...latest.profile, [change.section]: lines };
      }
      await saveDraft(env, agentId, latest);
    },
  };
}

// ---------- Needs attention ----------

type AttentionItem = {
  key: string;
  type: "team" | "lead" | "backup" | "price" | "fix_pending" | "fix_failing";
  at: string;
  conversationId?: string;
  leadId?: string;
  requestId?: string;
  fixId?: string;
  person?: { display_name: string | null; phone: string | null; external_user_id: string | null };
  message?: string;
  waitingDays?: number;
};

const undoable = (fix: { status: string; applied_at: string | null }) => ["verified", "kept_failing", "published"].includes(fix.status) && Boolean(fix.applied_at) && ageDays(fix.applied_at!) < 7;
const ageDays = (value: string) => Math.floor((Date.now() - new Date(/Z|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`).getTime()) / 86_400_000);

export function registerFixRoutes(app: Hono<AppEnv>) {
  app.post("/api/admin/agents/:id/fixes", async (c) => {
    const body = z
      .object({
        origin: z.enum(["test", "conversation", "attention"]),
        conversationId: z.string().max(300).optional(),
        customerMessage: z.string().min(1).max(4000),
        badReply: z.string().max(8000),
        correctReply: z.string().min(1).max(4000),
        lookups: z.array(z.object({ toolName: z.string(), recordId: z.string() })).max(20).default([]),
        fixId: z.string().optional(),
      })
      .parse(await c.req.json());
    const agent = await getAgent(c.env.DB, c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    const draft = agentDraftSchema.parse(JSON.parse(agent.draft_json));
    const question = maskContact(body.customerMessage.trim());
    const candidates = await loadCandidates(c.env, draft, body.lookups);
    const suggestion = await suggest(c.env, draft, question, body.badReply, body.correctReply.trim(), candidates);
    const fixId = body.fixId ?? id("fix");
    if (body.fixId) {
      await c.env.DB.prepare("UPDATE answer_fixes SET correct_reply=?,suggestion_json=? WHERE id=? AND agent_id=?").bind(body.correctReply.trim(), JSON.stringify(suggestion), fixId, agent.id).run();
    } else {
      await c.env.DB.prepare("INSERT INTO answer_fixes(id,agent_id,origin,conversation_id,customer_message,bad_reply,correct_reply,suggestion_json) VALUES(?,?,?,?,?,?,?,?)")
        .bind(fixId, agent.id, body.origin, body.conversationId ?? null, question, maskContact(body.badReply), body.correctReply.trim(), JSON.stringify(suggestion))
        .run();
    }
    await writeAudit(c.env.DB, "fix.suggested", "answer_fix", fixId, c.get("adminId"), { recommended: suggestion.recommended, ai: !suggestion.aiError });
    return c.json({ id: fixId, question, suggestion });
  });

  // Apply, save a Required scenario, test the draft. A failing change is undone in the same request unless "keep" is set.
  app.post("/api/admin/fixes/:fixId/apply", async (c) => {
    const body = z.object({ change: changeSchema, name: z.string().min(1).max(120), mustInclude: z.array(z.string().max(60)).max(3).default([]), mustNotInclude: z.array(z.string().max(60)).max(3).default([]), keep: z.boolean().default(false) }).parse(await c.req.json());
    const fix = await c.env.DB.prepare("SELECT * FROM answer_fixes WHERE id=?").bind(c.req.param("fixId")).first<{ id: string; agent_id: string; customer_message: string; correct_reply: string; status: string; eval_case_id: string | null }>();
    if (!fix) return c.json({ error: "Fix not found" }, 404);
    if (["verified", "kept_failing", "published"].includes(fix.status) && !body.keep) return c.json({ error: "This fix is already applied" }, 409);

    let applied: Awaited<ReturnType<typeof applyChange>>;
    try {
      applied = await applyChange(c.env, fix.agent_id, fix.id, body.change);
    } catch (error) {
      return c.json({ error: `Couldn't apply the fix — ${error instanceof Error ? error.message : "unknown error"}. Nothing changed for customers.` }, 422);
    }
    const toolName = body.change.kind === "data" ? applied.draft.collectionBindings.find((item) => item.collectionId === (body.change as { collectionId: string }).collectionId)?.toolName : undefined;
    const assertions: Assertions = { criteria: clip(`Gives the same key facts as: ${fix.correct_reply}`, 500), mustInclude: body.mustInclude.length ? body.mustInclude : undefined, mustNotInclude: body.mustNotInclude.length ? body.mustNotInclude : undefined, expectedTool: toolName, fromFix: fix.id };
    const caseId = id("case");
    await c.env.DB.prepare("INSERT INTO eval_cases(id,agent_id,name,input,assertions_json,critical) VALUES(?,?,?,?,?,1)").bind(caseId, fix.agent_id, body.name, fix.customer_message, JSON.stringify(assertions)).run();

    const kept = async () => {
      await c.env.DB.prepare("UPDATE answer_fixes SET status='kept_failing',target_kind=?,change_json=?,eval_case_id=?,applied_at=datetime('now') WHERE id=?").bind(body.change.kind, JSON.stringify({ ...body.change, ...applied.detail }), caseId, fix.id).run();
      await writeAudit(c.env.DB, "fix.kept_failing", "answer_fix", fix.id, c.get("adminId"), { kind: body.change.kind });
    };
    if (body.keep) {
      await kept();
      return c.json({ passed: false, kept: true, kind: body.change.kind, scenario: { id: caseId, name: body.name } });
    }

    const result = await runCase(c.env, fix.agent_id, applied.draft, { id: caseId, input: fix.customer_message, assertions_json: JSON.stringify(assertions) });
    if (result.passed) {
      await c.env.DB.prepare("UPDATE answer_fixes SET status='verified',target_kind=?,change_json=?,eval_case_id=?,applied_at=datetime('now'),verified_at=datetime('now') WHERE id=?").bind(body.change.kind, JSON.stringify({ ...body.change, ...applied.detail }), caseId, fix.id).run();
      await writeAudit(c.env.DB, "fix.verified", "answer_fix", fix.id, c.get("adminId"), { kind: body.change.kind });
      return c.json({ passed: true, kind: body.change.kind, reply: result.text, scenario: { id: caseId, name: body.name } });
    }
    await applied.revert();
    await c.env.DB.prepare("DELETE FROM eval_cases WHERE id=?").bind(caseId).run();
    await writeAudit(c.env.DB, "fix.auto_reverted", "answer_fix", fix.id, c.get("adminId"), { kind: body.change.kind, failures: result.failures.slice(0, 3) });
    return c.json({ passed: false, kind: body.change.kind, reply: result.text, failures: result.failures });
  });

  app.get("/api/admin/agents/:id/attention", async (c) => {
    const agent = await getAgent(c.env.DB, c.req.param("id"));
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    const real = "c.connection_id NOT IN ('preview','eval')";
    const person = "ct.display_name,ct.phone,c.external_user_id";
    const [team, leads, events, fixes, dismissed] = await Promise.all([
      c.env.DB.prepare(`SELECT c.id,c.last_activity_at AS at,${person} FROM conversations c LEFT JOIN contacts ct ON ct.id=c.contact_id WHERE ${real} AND c.agent_id=? AND c.human_takeover=1`).bind(agent.id).all<Record<string, string | null>>(),
      c.env.DB.prepare(`SELECT c.id,c.last_activity_at AS at,ct.id AS lead_id,${person} FROM conversations c LEFT JOIN contacts ct ON ct.id=c.contact_id WHERE ${real} AND c.agent_id=? AND c.stage='lead_captured' AND c.human_takeover=0 AND COALESCE(ct.lead_status,'new')='new'  AND c.last_activity_at >= datetime('now','-7 day')`).bind(agent.id).all<Record<string, string | null>>(),
      c.env.DB.prepare(`SELECT e.id,e.request_id,e.status,e.metadata_json,e.created_at AS at,c.id AS conversation_id,${person} FROM runtime_events e JOIN conversations c ON c.id=e.conversation_id LEFT JOIN contacts ct ON ct.id=c.contact_id WHERE ${real} AND e.agent_id=? AND e.created_at >= datetime('now','-7 day') AND (e.status='failed' OR e.metadata_json LIKE '%"priced":true%') ORDER BY e.created_at DESC LIMIT 40`).bind(agent.id).all<Record<string, string | null>>(),
      c.env.DB.prepare("SELECT id,status,target_kind,customer_message,COALESCE(applied_at,created_at) AS at FROM answer_fixes WHERE agent_id=? AND (status='kept_failing' OR (status='verified' AND target_kind IN ('knowledge','rule')))").bind(agent.id).all<Record<string, string | null>>(),
      c.env.DB.prepare("SELECT item_key FROM attention_dismissals").all<{ item_key: string }>(),
    ]);
    const hidden = new Set(dismissed.results.map((row) => row.item_key));
    const who = (row: Record<string, string | null>) => ({ display_name: row.display_name ?? null, phone: row.phone ?? null, external_user_id: row.external_user_id ?? null });
    const items: AttentionItem[] = [
      ...team.results.map((row) => ({ key: `team:${row.id}`, type: "team" as const, at: String(row.at), conversationId: String(row.id), person: who(row) })),
      ...leads.results.map((row) => ({ key: `lead:${row.id}`, type: "lead" as const, at: String(row.at), conversationId: String(row.id), leadId: row.lead_id ?? undefined, person: who(row) })),
      ...events.results.map((row) => ({
        key: `${row.status === "failed" ? "backup" : "price"}:${row.id}`,
        type: row.status === "failed" ? ("backup" as const) : ("price" as const),
        at: String(row.at),
        conversationId: String(row.conversation_id),
        requestId: String(row.request_id),
        person: who(row),
      })),
      ...fixes.results.map((row) => ({ key: `${row.status === "kept_failing" ? "fix_failing" : "fix_pending"}:${row.id}`, type: row.status === "kept_failing" ? ("fix_failing" as const) : ("fix_pending" as const), at: String(row.at), fixId: String(row.id), message: String(row.customer_message ?? "") })),
    ]
      .filter((item) => !hidden.has(item.key))
      .map((item) => ({ ...item, waitingDays: ageDays(item.at) >= (item.type === "lead" ? 1 : 2) ? ageDays(item.at) : undefined }));
    // Unpublished fixes only matter while the draft differs from the live version.
    const live = agent.active_version_id ? await c.env.DB.prepare("SELECT snapshot_json FROM agent_versions WHERE id=?").bind(agent.active_version_id).first<{ snapshot_json: string }>() : null;
    const unpublished = !live || JSON.stringify(agentDraftSchema.parse(JSON.parse(live.snapshot_json))) !== JSON.stringify(agentDraftSchema.parse(JSON.parse(agent.draft_json)));
    const visible = items.filter((item) => item.type !== "fix_pending" || unpublished);
    visible.sort((a, b) => Number(Boolean(b.waitingDays)) - Number(Boolean(a.waitingDays)) || (b.at > a.at ? 1 : -1));
    return c.json(visible.slice(0, 30));
  });

  app.get("/api/admin/fixes/:fixId", async (c) => {
    const fix = await c.env.DB.prepare("SELECT id,origin,conversation_id,customer_message,bad_reply,correct_reply,status,target_kind,applied_at FROM answer_fixes WHERE id=?").bind(c.req.param("fixId")).first<{ status: string; applied_at: string | null }>();
    return fix ? c.json({ ...fix, undoable: undoable(fix) }) : c.json({ error: "Fix not found" }, 404);
  });

  // Undo within 7 days: put the old value or line back and remove the fix's scenario. Data rows change for customers at once; instructions on the next Publish.
  app.post("/api/admin/fixes/:fixId/undo", async (c) => {
    const body = z.object({ reason: z.string().trim().max(300).default("") }).parse(await c.req.json().catch(() => ({})));
    const fix = await c.env.DB.prepare("SELECT id,agent_id,status,applied_at,target_kind,change_json,eval_case_id FROM answer_fixes WHERE id=?").bind(c.req.param("fixId"))
      .first<{ id: string; agent_id: string; status: string; applied_at: string | null; target_kind: string | null; change_json: string | null; eval_case_id: string | null }>();
    if (!fix) return c.json({ error: "Fix not found" }, 404);
    if (!undoable(fix)) return c.json({ error: fix.status === "undone" ? "This fix was already undone" : "Fixes can be undone for 7 days after they're applied" }, 409);
    const change = parseJson(fix.change_json ?? "{}", {} as Record<string, unknown>);
    let live = false;
    if (fix.target_kind === "data") {
      const record = await c.env.DB.prepare("SELECT data_json FROM data_records WHERE id=? AND collection_id=?").bind(String(change.recordId), String(change.collectionId)).first<{ data_json: string }>();
      if (record) {
        const data = parseJson(record.data_json, {} as Record<string, unknown>);
        const field = String(change.field);
        if (String(data[field] ?? "") !== String(change.after ?? "")) return c.json({ error: "That data row was edited after the fix. Change it on the Data page instead." }, 409);
        const restored = { ...data, [field]: change.before ?? "" };
        await c.env.DB.prepare("UPDATE data_records SET data_json=?,search_text=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(restored), Object.values(restored).join(" ").toLowerCase(), String(change.recordId)).run();
        live = true;
      }
    } else {
      const agent = await getAgent(c.env.DB, fix.agent_id);
      if (agent) {
        const draft = agentDraftSchema.parse(JSON.parse(agent.draft_json));
        if (fix.target_kind === "knowledge") draft.correctedAnswers = draft.correctedAnswers.filter((item) => item.fixId !== fix.id);
        else if (fix.target_kind === "rule") {
          const section = change.section as RuleSection;
          const lines = [...(draft.profile[section] ?? [])];
          const index = lines.lastIndexOf(String(change.line));
          if (index >= 0) lines.splice(index, 1);
          draft.profile = { ...draft.profile, [section]: lines };
        }
        await saveDraft(c.env, fix.agent_id, draft);
      }
    }
    await c.env.DB.batch([
      ...(fix.eval_case_id ? [c.env.DB.prepare("DELETE FROM eval_cases WHERE id=?").bind(fix.eval_case_id)] : []),
      c.env.DB.prepare("UPDATE answer_fixes SET status='undone' WHERE id=?").bind(fix.id),
    ]);
    await writeAudit(c.env.DB, "fix.undone", "answer_fix", fix.id, c.get("adminId"), { kind: fix.target_kind, reason: body.reason });
    return c.json({ undone: true, live });
  });

  app.post("/api/admin/attention/dismiss", async (c) => {
    const body = z.object({ key: z.string().min(3).max(300), reason: z.enum(["answer_fine", "handled", "not_customer"]) }).parse(await c.req.json());
    await c.env.DB.prepare("INSERT OR REPLACE INTO attention_dismissals(item_key,reason) VALUES(?,?)").bind(body.key, body.reason).run();
    await writeAudit(c.env.DB, "attention.dismissed", "attention", body.key, c.get("adminId"), { reason: body.reason });
    return c.json({ dismissed: true });
  });

  app.delete("/api/admin/attention/dismiss/:key", async (c) => {
    await c.env.DB.prepare("DELETE FROM attention_dismissals WHERE item_key=?").bind(c.req.param("key")).run();
    return c.json({ restored: true });
  });
}

// Publishing sends verified draft fixes to customers.
export async function markFixesPublished(env: Env, agentId: string, versionId: string) {
  await env.DB.prepare("UPDATE answer_fixes SET status='published',published_version_id=? WHERE agent_id=? AND status='verified' AND target_kind IN ('knowledge','rule')").bind(versionId, agentId).run();
}
