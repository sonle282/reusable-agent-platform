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

export function normalizeZernio(payload: ZernioPayload, connection: ConnectionRow, eventIdHeader?: string): NormalizedMessage {
  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
  const message = (data.message && typeof data.message === "object" ? data.message : data) as Record<string, unknown>;
  const contact = (data.contact && typeof data.contact === "object" ? data.contact : {}) as Record<string, unknown>;
  const eventId = eventIdHeader || String(payload.id ?? data.id ?? crypto.randomUUID());
  const conversationId = String(data.conversation_id ?? data.conversationId ?? objectAt(data, "conversation", "id") ?? contact.id ?? eventId);
  const userId = String(contact.id ?? data.user_id ?? data.userId ?? objectAt(data, "sender", "id") ?? conversationId);
  return {
    eventId,
    connectionId: connection.id,
    agentId: connection.agent_id,
    conversationId,
    externalUserId: userId,
    content: { text: String(message.text ?? message.content ?? data.text ?? "") },
    customer: {
      name: typeof contact.name === "string" ? contact.name : undefined,
      locale: typeof contact.locale === "string" ? contact.locale : undefined,
      metadata: { zernio: { contactId: contact.id, inboxId: objectAt(data, "inbox", "id") } },
    },
    receivedAt: new Date().toISOString(),
  };
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
    const endpoint = String(config.inboxApiUrl ?? "");
    assertZernioEndpoint(endpoint);
    const statuses: number[] = [];
    for (let index = 0; index < result.messages.length; index++) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": `${result.requestId}:${index}` },
        body: JSON.stringify({ conversation_id: result.conversationId, type: "text", text: result.messages[index].text }),
      });
      if (!response.ok) throw new Error(`Zernio delivery returned ${response.status}`);
      statuses.push(response.status);
    }
    return { statuses };
  }
  throw new Error("Unsupported connection type");
}

function assertZernioEndpoint(value: string) {
  assertSafeHttpsUrl(value);
}
