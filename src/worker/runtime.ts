import { getAgentByName } from "agents";
import type { AgentResult, AgentVersionSnapshot, NormalizedMessage } from "../shared/contracts";
import { ConversationAgent } from "./agent";

export interface AgentRuntime {
  handleMessage(input: NormalizedMessage, options?: { versionId?: string; snapshotOverride?: AgentVersionSnapshot }): Promise<AgentResult>;
}

// Symbol.dispose exists in the Workers runtime; the TS lib used here doesn't declare it yet.
const DISPOSE = (Symbol as unknown as { dispose?: symbol }).dispose;
const release = (value: unknown) => {
  try {
    if (DISPOSE && value && typeof value === "object") (value as Record<symbol, (() => void) | undefined>)[DISPOSE]?.();
  } catch {
    // already released
  }
};

// Calls into a conversation's Durable Object and releases the RPC stub (and result) as soon as the call returns.
// Without this the object stays open, and billed, until the calling request ends: a 9-minute scenario run kept
// every conversation it touched open for minutes (root cause of the 2026-10-11 free-tier outage).
export async function withConversation<T>(env: Env, name: string, call: (stub: ConversationAgent) => Promise<T>): Promise<T> {
  const locationHint = (env.CONVERSATION_LOCATION_HINT || undefined) as DurableObjectLocationHint | undefined;
  const stub = await getAgentByName<Env, ConversationAgent>(env.ConversationAgent as unknown as DurableObjectNamespace<ConversationAgent>, name, { locationHint });
  try {
    const result = await call(stub as unknown as ConversationAgent);
    // Results are plain data; copy them out, then let go of anything the RPC layer attached.
    const copy = result === undefined ? result : (structuredClone(result) as T);
    release(result);
    return copy;
  } finally {
    release(stub);
  }
}

export const conversationName = (agentId: string, connectionId: string, conversationId: string) => `${agentId}:${connectionId}:${conversationId}`;

export class CloudflareAgentRuntime implements AgentRuntime {
  constructor(private readonly env: Env) {}

  async handleMessage(input: NormalizedMessage, options: { versionId?: string; snapshotOverride?: AgentVersionSnapshot } = {}) {
    return withConversation(this.env, conversationName(input.agentId, input.connectionId, input.conversationId), (stub) => stub.processMessage(input, options));
  }
}
