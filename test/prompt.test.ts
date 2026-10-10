import { describe, expect, it } from "vitest";
import { composeSystemPrompt, hasProfile } from "../src/shared/prompt";
import { agentDraftSchema, starterDraft } from "../src/shared/contracts";

describe("composeSystemPrompt", () => {
  it("keeps a legacy playbook-only draft unchanged", () => {
    expect(composeSystemPrompt({ instructions: "You are a consultant." })).toBe("You are a consultant.");
  });

  it("renders owner sections first and lets them win over the playbook", () => {
    const prompt = composeSystemPrompt({
      profile: { businessName: "Acme Bikes", job: "Recommend bikes.", neverDo: ["Invent prices", " "], collectDetails: ["name", "phone"] },
      instructions: "Long playbook",
    });
    expect(prompt.indexOf("# BUSINESS")).toBeLessThan(prompt.indexOf("# DETAILED PLAYBOOK"));
    expect(prompt).toContain("- Invent prices");
    expect(prompt).not.toContain("- \n");
    expect(prompt).toContain("ask for: name, phone");
    expect(prompt).toContain("win whenever the playbook below disagrees");
  });

  it("parses old snapshots without a profile", () => {
    const draft = agentDraftSchema.parse({ instructions: "x" });
    expect(draft.profile.alwaysDo).toEqual([]);
    expect(hasProfile(draft)).toBe(false);
  });

  it("gives every starter template a usable, industry-neutral profile", () => {
    for (const template of ["sales", "support"] as const) {
      const draft = starterDraft(template);
      expect(hasProfile(draft)).toBe(true);
      expect(composeSystemPrompt(draft)).not.toMatch(/spa|nail|salon/i);
    }
  });
});

describe("corrected answers", () => {
  it("adds owner-corrected Q&A as checked facts and skips empty pairs", () => {
    const prompt = composeSystemPrompt({ correctedAnswers: [{ question: "Có ưu đãi 8 ghế không?", answer: "Free giao hàng từ 6 ghế." }, { question: " ", answer: "x" }] });
    expect(prompt).toContain("# CORRECTED ANSWERS");
    expect(prompt).toContain("Q: Có ưu đãi 8 ghế không?\nA: Free giao hàng từ 6 ghế.");
    expect(prompt).not.toContain("A: x");
  });
});
