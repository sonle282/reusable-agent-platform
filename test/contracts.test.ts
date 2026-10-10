import { describe, expect, it } from "vitest";
import { agentDraftSchema, genericMessageSchema, starterDraft } from "../src/shared/contracts";

describe("agent contracts", () => {
  it("creates complete immutable snapshot defaults", () => {
    const draft = starterDraft("sales");
    expect(draft.profile.job).toContain("recommend");
    expect(draft.modelConfig.provider).toBe("anthropic");
    expect(agentDraftSchema.parse(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
  });

  it("requires a message body or attachment", () => {
    expect(() => genericMessageSchema.parse({ conversation_id: "c1", user_id: "u1", message: { attachments: [] } })).toThrow();
    expect(genericMessageSchema.parse({ conversation_id: "c1", user_id: "u1", message: { text: "hello" } }).response_mode).toBe("sync");
  });
});


describe("model sampling compatibility", () => {
  it("only sends temperature to models that accept sampling parameters", async () => {
    const { modelSupportsTemperature, anthropicModelSchema } = await import("../src/shared/contracts");
    expect(modelSupportsTemperature("claude-sonnet-4-6")).toBe(true);
    expect(modelSupportsTemperature("claude-sonnet-5")).toBe(false);
    expect(modelSupportsTemperature("claude-sonnet-5-5")).toBe(false);
    expect(anthropicModelSchema.parse("claude-opus-5-5")).toBe("claude-opus-5-5");
  });
});
