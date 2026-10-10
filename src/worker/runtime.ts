import { getAgentByName } from "agents";
import type { AgentResult, AgentVersionSnapshot, NormalizedMessage } from "../shared/contracts";
import { ConversationAgent } from "./agent";

export interface AgentRuntime {
  handleMessage(input: NormalizedMessage, options?: { versionId?: string; snapshotOverride?: AgentVersionSnapshot }): Promise<AgentResult>;
}

export class CloudflareAgentRuntime implements AgentRuntime {
  constructor(private readonly env: Env) {}

  async handleMessage(input: NormalizedMessage, options: { versionId?: string; snapshotOverride?: AgentVersionSnapshot } = {}) {
    const name = `${input.agentId}:${input.connectionId}:${input.conversationId}`;
    const locationHint = (this.env.CONVERSATION_LOCATION_HINT || undefined) as DurableObjectLocationHint | undefined;
    const stub = await getAgentByName<Env, ConversationAgent>(this.env.ConversationAgent as unknown as DurableObjectNamespace<ConversationAgent>, name, { locationHint });
    return (stub as unknown as { processMessage(message: NormalizedMessage, runtimeOptions: { versionId?: string; snapshotOverride?: AgentVersionSnapshot }): Promise<AgentResult> })
      .processMessage(input, options);
  }
}
