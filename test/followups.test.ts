import { describe, expect, it } from "vitest";
import { followUpsSchema } from "../src/shared/contracts";
import { OPT_OUT, asksAboutPrice, decideFollowUp, dueAt, followUpKey, type FollowUpState } from "../src/shared/followups";

const config = followUpsSchema.parse({});
const last = "2026-10-11T10:00:00.000Z";
const at = (hours: number) => Date.parse(last) + hours * 3_600_000;
const quiet: FollowUpState = { lastCustomerAt: last, askedPrice: true, contactCaptured: false, optedOut: false };

describe("follow-up timing", () => {
  it("is due after the step delay and never at or after 23h50m", () => {
    expect(dueAt(last, "2h")).toBe(at(2));
    expect(dueAt(last, "23h")).toBe(at(23));
    expect(dueAt("not a date", "2h")).toBeNull();
  });
  it("uses one key per step per quiet period", () => {
    expect(followUpKey("c1", 0, last)).toBe(followUpKey("c1", 0, last));
    expect(followUpKey("c1", 0, last)).not.toBe(followUpKey("c1", 1, last));
    expect(followUpKey("c1", 0, last)).not.toBe(followUpKey("c1", 0, "2026-10-11T11:00:00.000Z"));
  });
});

describe("decideFollowUp", () => {
  const base = { config, step: 0, state: quiet, scheduledFor: last, now: at(2) };
  it("sends when the customer asked a price and went quiet", () => {
    expect(decideFollowUp(base)).toEqual({ send: true });
  });
  it("never sends 24 hours after the customer's last message", () => {
    expect(decideFollowUp({ ...base, now: at(24) })).toEqual({ send: false, reason: "window_closed" });
    expect(decideFollowUp({ ...base, now: at(23.9) })).toEqual({ send: false, reason: "window_closed" });
  });
  it("stops when the customer replied after it was scheduled", () => {
    expect(decideFollowUp({ ...base, state: { ...quiet, lastCustomerAt: "2026-10-11T11:00:00.000Z" } })).toEqual({ send: false, reason: "customer_replied" });
  });
  it("stops on contact, opt-out, closed lead, takeover, no price question, or turned off", () => {
    expect(decideFollowUp({ ...base, state: { ...quiet, contactCaptured: true } })).toMatchObject({ reason: "contact_captured" });
    expect(decideFollowUp({ ...base, state: { ...quiet, optedOut: true } })).toMatchObject({ reason: "opted_out" });
    expect(decideFollowUp({ ...base, leadStatus: "won" })).toMatchObject({ reason: "lead_closed" });
    expect(decideFollowUp({ ...base, leadStatus: "not_fit" })).toMatchObject({ reason: "lead_closed" });
    expect(decideFollowUp({ ...base, leadStatus: "called" })).toEqual({ send: true });
    expect(decideFollowUp({ ...base, takeover: true })).toMatchObject({ reason: "team_took_over" });
    expect(decideFollowUp({ ...base, state: { ...quiet, askedPrice: false } })).toMatchObject({ reason: "no_price_question" });
    expect(decideFollowUp({ ...base, config: { ...config, enabled: false } })).toMatchObject({ reason: "turned_off" });
    expect(decideFollowUp({ ...base, config: { ...config, steps: [{ ...config.steps[0], condition: "any_no_contact" }] }, state: { ...quiet, askedPrice: false } })).toEqual({ send: true });
  });
});

describe("signals", () => {
  it("spots price questions and opt-outs in English and Vietnamese", () => {
    expect(asksAboutPrice("Ghế này giá bao nhiêu?", [], false)).toBe(true);
    expect(asksAboutPrice("hello", ["search_products"], false)).toBe(true);
    expect(asksAboutPrice("bảo hành bao lâu", ["search_policies"], false)).toBe(false);
    expect(OPT_OUT.test("Thôi em, anh không cần nữa")).toBe(true);
    expect(OPT_OUT.test("Please stop messaging me")).toBe(true);
    expect(OPT_OUT.test("Cần 6 ghế")).toBe(false);
  });
});
