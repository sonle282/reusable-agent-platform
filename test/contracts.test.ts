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

describe("version snapshots before v2.1", () => {
  it("keep behavior and follow-ups off; new drafts get them on", async () => {
    const { agentDraftSchema, parseVersionSnapshot } = await import("../src/shared/contracts");
    const old = parseVersionSnapshot({ instructions: "x" });
    expect(old.behavior.typing).toBe(false);
    expect(old.behavior.aiNotice).toBe(false);
    expect(old.followUps.enabled).toBe(false);
    const draft = agentDraftSchema.parse({ instructions: "x" });
    expect(draft.behavior.typing).toBe(true);
    expect(draft.followUps.steps).toHaveLength(2);
    expect(parseVersionSnapshot(draft)).toEqual(draft);
  });
});
