import { describe, expect, it } from "vitest";
import { FORMAT_RULE, composeSystemPrompt, hasProfile, lengthRule } from "../src/shared/prompt";
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

describe("privacy notice", () => {
  it("is said before the first request for contact details, only when set", () => {
    const withNotice = composeSystemPrompt({ profile: { collectDetails: ["Phone number"], consentNotice: "We only use your number for this quote." } });
    expect(withNotice).toContain('first tell the customer this, in their language and briefly: "We only use your number for this quote."');
    expect(composeSystemPrompt({ profile: { collectDetails: ["Phone number"] } })).not.toContain("first tell the customer");
  });
});

describe("reply length", () => {
  it("is off when the limit is 0", () => {
    expect(lengthRule(0)).toBe("");
  });

  it("keeps the sentence limit for everything except a matching Q&A answer", () => {
    const rule = lengthRule(3);
    expect(rule).toContain("at most 3 short sentences");
    expect(rule).toContain("matches a Q&A or FAQ entry in KNOWLEDGE, give every point of that entry's answer");
    expect(rule).toContain("worded as in the Q&A (adapt only the pronouns and the language)");
    expect(rule).toContain("never shorten it or drop a clause");
    expect(rule).toContain("keep anything you add to it within the limit");
    // The old "Cut extras rather than go over" made the model drop the last clause of a long Q&A answer.
    expect(rule).not.toMatch(/Cut extras rather than go over\.$/);
    expect(rule).toContain("never part of a Q&A answer");
  });

  it("stays industry-neutral", () => {
    expect(lengthRule(3)).not.toMatch(/spa|nail|salon|acetone|215/i);
  });
});
