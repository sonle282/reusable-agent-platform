import { post } from "./api";

// Publish the draft: it becomes the live version for new chats.
export async function publishDraft(agentId: string) {
  return post<{ version: number }>(`/api/admin/agents/${agentId}/publish`);
}
