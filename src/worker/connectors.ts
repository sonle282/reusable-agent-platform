import type { AgentResult, NormalizedMessage } from "../shared/contracts";
import type { ConnectionRow } from "./db";
import { assertSafeHttpsUrl } from "./knowledge";
import { decryptCredential, hmacHex, constantTimeEqual } from "./security/crypto";

type ZernioPayload = Record<string, unknown>;

function objectAt(value: unknown, ...keys: string[]) {
  let current: unknown = value;
  for (const key of keys) current = current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
  return current;
}

export async function verifyZernio(env: Env, rawBody: string, signature: string, connection: ConnectionRow) {
  const config = JSON.parse(connection.config_json) as Record<string, unknown>;
  const secretId = String(config.webhookSecretCredentialId ?? "");
  const row = await env.DB.prepare("SELECT ciphertext, iv FROM credentials WHERE id = ?").bind(secretId).first<{ ciphertext: string; iv: string }>();
  if (!row) return false;
  const secret = await decryptCredential(row.ciphertext, row.iv, env.CREDENTIAL_ENCRYPTION_KEY);
  const expected = await hmacHex(secret, rawBody);
  return constantTimeEqual(signature.replace(/^sha256=/i, "").toLowerCase(), expected.toLowerCase());
}

export const ZERNIO_API = "https://zernio.com/api/v1";

type ZernioEvent = { kind: "message"; input: NormalizedMessage; accountId?: string } | { kind: "ignore"; reason: string };

// Zernio sends one webhook shape for every platform (docs.zernio.com/webhooks/inbox):
// { id, event, message: { conversationId, direction, text, attachments, sender }, conversation, account: { accountId }, metadata }.
export function parseZernioEvent(payload: ZernioPayload, connection: ConnectionRow, eventIdHeader?: string): ZernioEvent {
  const event = String(payload.event ?? "");
  if (event !== "message.received") return { kind: "ignore", reason: event || "unknown event" };
  const message = (payload.message && typeof payload.message === "object" ? payload.message : {}) as Record<string, unknown>;
  if (message.direction && message.direction !== "incoming") return { kind: "ignore", reason: "outgoing message" };
  if (objectAt(payload, "metadata", "standby") === true) return { kind: "ignore", reason: "another app owns this thread" };
  const sender = (message.sender && typeof message.sender === "object" ? message.sender : {}) as Record<string, unknown>;
  const conversationId = String(message.conversationId ?? objectAt(payload, "conversation", "id") ?? "");
  if (!conversationId) return { kind: "ignore", reason: "no conversation id" };
  const attachments = Array.isArray(message.attachments) ? (message.attachments as Array<Record<string, unknown>>) : [];
  const images = attachments
    .filter((item) => item.type === "image" && typeof item.url === "string")
    .slice(0, 4)
    .map((item, index) => ({ url: String(item.url), mimeType: String(item.mimeType ?? "image/jpeg"), name: `image-${index + 1}` }));
  const text = String(message.text ?? "").trim();
  const accountId = String(objectAt(payload, "account", "accountId") ?? objectAt(payload, "account", "id") ?? "") || undefined;
  return {
    kind: "message",
    accountId,
    input: {
      eventId: eventIdHeader || String(payload.id ?? message.id ?? crypto.randomUUID()),
      connectionId: connection.id,
      agentId: connection.agent_id,
      conversationId,
      externalUserId: String(sender.id ?? sender.contactId ?? conversationId),
      content: { text: text || (images.length ? "(sent a photo)" : ""), images: images.length ? images : undefined },
      customer: {
        name: typeof sender.name === "string" ? sender.name : undefined,
        metadata: { zernio: { accountId, platform: message.platform, contactId: sender.contactId } },
      },
      receivedAt: new Date().toISOString(),
    },
  };
}

// Kept for older callers and tests; returns the normalized message or throws for events we ignore.
export function normalizeZernio(payload: ZernioPayload, connection: ConnectionRow, eventIdHeader?: string): NormalizedMessage {
  const parsed = parseZernioEvent(payload, connection, eventIdHeader);
  if (parsed.kind === "ignore") throw new Error(`Ignored Zernio event: ${parsed.reason}`);
  return parsed.input;
}

export async function zernioRequest<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${apiKey}`);
  if (init.body) headers.set("content-type", "application/json");
  const response = await fetch(`${ZERNIO_API}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!response.ok) throw new Error(`Zernio returned ${response.status}${body?.error || body?.message ? `: ${String(body.error ?? body.message).slice(0, 200)}` : ""}`);
  return body;
}

export async function sendOutbound(env: Env, connection: ConnectionRow, result: AgentResult) {
  if (result.status === "human_handoff" || result.messages.length === 0) return { skipped: true };
  const config = JSON.parse(connection.config_json) as Record<string, unknown>;
  if (connection.type === "generic_api" || connection.type === "generic_webhook") {
    if (!connection.callback_url) return { skipped: true };
    const callback = assertSafeHttpsUrl(connection.callback_url);
    const response = await fetch(callback, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": result.requestId },
      body: JSON.stringify({ request_id: result.requestId, conversation_id: result.conversationId, messages: result.messages, status: result.status }),
    });
    if (!response.ok) throw new Error(`Callback returned ${response.status}`);
    return { status: response.status };
  }
  if (connection.type === "zernio") {
    if (!connection.credential_id) throw new Error("Zernio API credential is missing");
    const credential = await env.DB.prepare("SELECT ciphertext, iv FROM credentials WHERE id = ?").bind(connection.credential_id).first<{ ciphertext: string; iv: string }>();
    if (!credential) throw new Error("Zernio API credential not found");
    const token = await decryptCredential(credential.ciphertext, credential.iv, env.CREDENTIAL_ENCRYPTION_KEY);
    const accountId = String(config.accountId ?? "");
    if (!accountId) throw new Error("Zernio account is not set on this channel");
    const statuses: number[] = [];
    for (let index = 0; index < result.messages.length; index++) {
      const response = await fetch(`${ZERNIO_API}/inbox/conversations/${encodeURIComponent(result.conversationId ?? "")}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": `${result.requestId}:${index}` },
        body: JSON.stringify({ accountId, message: result.messages[index].text.slice(0, 9999), messagingType: "RESPONSE" }),
      });
      if (!response.ok) throw new Error(`Zernio delivery returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
      statuses.push(response.status);
    }
    return { statuses };
  }
  throw new Error("Unsupported connection type");
}
