// Follow-ups inside Meta's 24-hour window: when they are due, and whether one may still be sent.
import type { FollowUps } from "./contracts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const DELAY_MS: Record<FollowUps["steps"][number]["delay"], number> = { "30m": 30 * MINUTE, "1h": HOUR, "2h": 2 * HOUR, "4h": 4 * HOUR, "12h": 12 * HOUR, "20h": 20 * HOUR, "23h": 23 * HOUR };
export const DELAY_LABEL: Record<FollowUps["steps"][number]["delay"], string> = { "30m": "30 minutes", "1h": "1 hour", "2h": "2 hours", "4h": "4 hours", "12h": "12 hours", "20h": "20 hours", "23h": "23 hours" };
// Meta allows free-form messages for 24 h after the customer's last message. Leave a margin for a late alarm.
export const WINDOW_MS = 24 * HOUR;
export const LAST_SAFE_MS = 23 * HOUR + 50 * MINUTE;

export const OPT_OUT = /\b(stop|unsubscribe|not interested|no thanks)\b|không cần|ko cần|đừng nhắn|khỏi nhắn|không quan tâm/i;
const PRICE_WORDS = /\b(price|prices|cost|quote|how much)\b|giá|bao nhiêu|báo giá/i;

export type FollowUpState = {
  lastCustomerAt: string;
  askedPrice: boolean;
  contactCaptured: boolean;
  optedOut: boolean;
  scheduleId?: string;
};

export const emptyFollowUpState: FollowUpState = { lastCustomerAt: "", askedPrice: false, contactCaptured: false, optedOut: false };

// "Asked about price": looked up products or offers, quoted a price, or asked for one.
export function asksAboutPrice(customerText: string, toolNames: string[], replyMentionsPrice: boolean) {
  return replyMentionsPrice || toolNames.some((name) => /product|offer|price|catalog/i.test(name)) || PRICE_WORDS.test(customerText);
}

export function dueAt(lastCustomerAt: string, delay: FollowUps["steps"][number]["delay"]): number | null {
  const last = Date.parse(lastCustomerAt);
  if (Number.isNaN(last)) return null;
  return DELAY_MS[delay] >= LAST_SAFE_MS ? null : last + DELAY_MS[delay];
}

// One key per step per quiet period: a replayed alarm can never send the same follow-up twice.
export const followUpKey = (conversationId: string, step: number, lastCustomerAt: string) => `followup:${conversationId}:${step}:${lastCustomerAt}`;

export type FollowUpDecision = { send: true } | { send: false; reason: string };

export function decideFollowUp(input: {
  config: FollowUps;
  step: number;
  state: FollowUpState;
  scheduledFor: string;
  now: number;
  leadStatus?: string | null;
  takeover?: boolean;
}): FollowUpDecision {
  const { config, step, state } = input;
  const item = config.steps[step];
  if (!config.enabled) return { send: false, reason: "turned_off" };
  if (!item) return { send: false, reason: "no_step" };
  if (input.scheduledFor !== state.lastCustomerAt) return { send: false, reason: "customer_replied" };
  const quiet = input.now - Date.parse(state.lastCustomerAt);
  if (!(quiet < LAST_SAFE_MS) || quiet >= WINDOW_MS) return { send: false, reason: "window_closed" };
  if (input.takeover) return { send: false, reason: "team_took_over" };
  if (state.contactCaptured) return { send: false, reason: "contact_captured" };
  if (state.optedOut) return { send: false, reason: "opted_out" };
  if (input.leadStatus === "won" || input.leadStatus === "not_fit") return { send: false, reason: "lead_closed" };
  if (item.condition === "price_no_contact" && !state.askedPrice) return { send: false, reason: "no_price_question" };
  return { send: true };
}
