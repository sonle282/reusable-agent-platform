import { modelSupportsTemperature, type AgentVersionSnapshot } from "../../shared/contracts";
import { decryptCredential } from "../security/crypto";

export type ModelMessage = {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export type ModelTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ModelResponse = {
  id: string;
  stopReason: string | null;
  text: string;
  content: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
};

async function credentialValue(env: Env, credentialId?: string | null) {
  if (!credentialId) throw new Error("Anthropic credential is not configured");
  const row = await env.DB.prepare("SELECT ciphertext, iv FROM credentials WHERE id = ? AND kind = 'anthropic_api_key'")
    .bind(credentialId).first<{ ciphertext: string; iv: string }>();
  if (!row) throw new Error("Anthropic credential not found");
  return decryptCredential(row.ciphertext, row.iv, env.CREDENTIAL_ENCRYPTION_KEY);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("model_timeout"), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function generateWithAnthropic(
  env: Env,
  config: AgentVersionSnapshot["modelConfig"],
  system: string,
  messages: ModelMessage[],
  tools: ModelTool[],
  requestId: string,
): Promise<ModelResponse> {
  const apiKey = await credentialValue(env, config.credentialId);
  const accountId = config.accountId || env.CF_ACCOUNT_ID;
  const gatewayId = config.gatewayId || env.AI_GATEWAY_ID;
  if (!accountId || !gatewayId) throw new Error("Cloudflare account ID or AI Gateway ID is not configured");

  const url = `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${encodeURIComponent(gatewayId)}/anthropic/v1/messages`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
    "x-api-key": apiKey,
    "cf-aig-metadata": JSON.stringify({ requestId }),
  };
  if (env.AI_GATEWAY_TOKEN) headers["cf-aig-authorization"] = `Bearer ${env.AI_GATEWAY_TOKEN}`;

  const init: RequestInit = {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: modelSupportsTemperature(config.model) ? config.temperature : undefined,
        system,
        messages,
        tools: tools.length ? tools : undefined,
      }),
    };
  let response = await fetchWithTimeout(url, init, config.timeoutMs);
  if (response.status === 429 || response.status >= 500) response = await fetchWithTimeout(url, init, config.timeoutMs);

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Model gateway returned ${response.status}: ${detail}`);
  }
  const data = await response.json() as {
    id: string; stop_reason: string | null; content: Array<Record<string, unknown>>; usage?: Record<string, unknown>;
  };
  return {
    id: data.id,
    stopReason: data.stop_reason,
    content: data.content,
    text: data.content.filter((block) => block.type === "text").map((block) => String(block.text ?? "")).join("\n").trim(),
    usage: data.usage,
  };
}
