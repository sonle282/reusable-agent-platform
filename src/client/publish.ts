import { post } from "./api";

// Publish the draft: it becomes the live version for every chat from the customer's next message.
export async function publishDraft(agentId: string) {
  return post<{ version: number }>(`/api/admin/agents/${agentId}/publish`);
}
