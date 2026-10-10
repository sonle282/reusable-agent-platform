import { describe, expect, it } from "vitest";
import { agentDraftSchema, genericMessageSchema, starterDraft } from "../src/shared/contracts";

describe("agent contracts", () => {
  it("creates complete immutable snapshot defaults", () => {
    const draft = starterDraft("sales");
    expect(draft.instructions).toContain("tư vấn");
    expect(draft.modelConfig.provider).toBe("anthropic");
    expect(agentDraftSchema.parse(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
  });

  it("requires a message body or attachment", () => {
    expect(() => genericMessageSchema.parse({ conversation_id: "c1", user_id: "u1", message: { attachments: [] } })).toThrow();
    expect(genericMessageSchema.parse({ conversation_id: "c1", user_id: "u1", message: { text: "hello" } }).response_mode).toBe("sync");
  });
});

