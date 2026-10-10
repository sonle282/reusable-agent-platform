import { api, post } from "./api";
import type { AgentDetail, EvalRun } from "./types";

// Same gate as the Publish button: run the scenarios, publish only when they all pass.
export async function publishWithChecks(agentId: string): Promise<{ ok: true; version: number } | { ok: false; failed: string }> {
  const agent = await api<AgentDetail>(`/api/admin/agents/${agentId}`);
  if (agent.evalCases.length) {
    const run = await post<EvalRun>(`/api/admin/agents/${agentId}/evaluate`);
    if (!run.passed) {
      const failed = agent.evalCases.find((item) => run.results.some((result) => result.caseId === item.id && !result.passed));
      return { ok: false, failed: failed?.name ?? "A scenario" };
    }
  }
  const result = await post<{ version: number }>(`/api/admin/agents/${agentId}/publish`);
  return { ok: true, version: result.version };
}
