import { z } from "zod";
import { anthropicModels, modelSupportsTemperature, type AnthropicModel } from "./models";
import { emptyProfile } from "./prompt";

export const fieldTypeSchema = z.enum([
  "text", "long_text", "number", "boolean", "date", "datetime", "enum",
  "multi_enum", "url", "image_url", "relation",
]);

export const collectionFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(120),
  type: fieldTypeSchema,
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const collectionSchema = z.object({
  fields: z.array(collectionFieldSchema).max(80),
});

export const anthropicModelSchema = z.enum(anthropicModels);
export { modelSupportsTemperature, type AnthropicModel };

export const modelConfigSchema = z.object({
  provider: z.literal("anthropic").default("anthropic"),
  model: anthropicModelSchema.default("claude-haiku-5-5"),
  credentialId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  gatewayId: z.string().nullable().optional(),
  temperature: z.number().min(0).max(1).default(0.2),
  maxTokens: z.number().int().min(128).max(8192).default(4096),
  timeoutMs: z.number().int().min(3000).max(90000).default(45000),
});

export const collectionBindingSchema = z.object({
  collectionId: z.string().min(1),
  toolName: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  purpose: z.string().min(1).max(500),
});

const ruleList = z.array(z.string().max(1000)).max(50).default([]);

// Owner-editable, industry-neutral description of the assistant; composed into the system prompt.
export const assistantProfileSchema = z.object({
  businessName: z.string().max(200).default(""),
  offering: z.string().max(2000).default(""),
  contactInfo: z.string().max(2000).default(""),
  website: z.string().max(500).default(""),
  job: z.string().max(4000).default(""),
  voice: z.string().max(4000).default(""),
  alwaysDo: ruleList,
  neverDo: ruleList,
  handoffWhen: ruleList,
  collectDetails: z.array(z.string().max(100)).max(20).default([]),
  consentNotice: z.string().max(500).default(""),
});

const fallbackMessage = "Sorry, I can't answer right now. A team member will get back to you shortly.";

// How replies feel on chat channels (v2.1 Behavior tab). Part of the draft, published with the version.
export const behaviorSchema = z.object({
  markSeen: z.boolean().default(true),
  typing: z.boolean().default(true),
  splitReplies: z.boolean().default(true),
  pace: z.enum(["instant", "natural", "slow"]).default("natural"),
  aiNotice: z.boolean().default(true),
  aiNoticeText: z.string().trim().max(300).default("I'm the business's AI assistant. Ask for a person anytime and the team will reply."),
  outsideHours: z.enum(["callback", "none"]).default("callback"),
  // Chat replies stay short: at most this many sentences per reply (0 = no limit). Scenarios fail when a reply is longer.
  maxSentences: z.number().int().min(0).max(10).default(3),
});
export type Behavior = z.infer<typeof behaviorSchema>;

export const FOLLOW_UP_DELAYS = ["30m", "1h", "2h", "4h", "12h", "20h", "23h"] as const;
export const followUpStepSchema = z.object({
  delay: z.enum(FOLLOW_UP_DELAYS),
  condition: z.enum(["price_no_contact", "any_no_contact"]).default("price_no_contact"),
  // Sent exactly as written; no model call.
  text: z.string().trim().min(1).max(1000),
});
// Nudges inside Meta's 24-hour window (v2.1 Follow-ups tab).
export const followUpsSchema = z.object({
  enabled: z.boolean().default(true),
  contactAgain: z.boolean().default(true),
  steps: z.array(followUpStepSchema).max(2).default([
    { delay: "2h", condition: "price_no_contact", text: "Just following up: if you'd like an exact quote, leave your phone number and our team will send it to you." },
    { delay: "20h", condition: "price_no_contact", text: "If you have more questions or want to see other options, message us here anytime." },
  ]),
});
export type FollowUps = z.infer<typeof followUpsSchema>;

// Versions published before v2.1 have neither block: they keep behaving exactly as they did.
export const LEGACY_BEHAVIOR: Behavior = { markSeen: false, typing: false, splitReplies: false, pace: "instant", aiNotice: false, aiNoticeText: "", outsideHours: "none", maxSentences: 0 };
export const LEGACY_FOLLOW_UPS: FollowUps = { enabled: false, contactAgain: false, steps: [] };

export const agentDraftSchema = z.object({
  profile: assistantProfileSchema.default(emptyProfile),
  // Detailed playbook (advanced). Optional once the profile is filled in.
  instructions: z.string().default(""),
  modelConfig: modelConfigSchema.default({ provider: "anthropic", model: "claude-haiku-5-5", temperature: 0.2, maxTokens: 4096, timeoutMs: 45000 }),
  responsePolicy: z.object({
    fallbackMessage: z.string().default(fallbackMessage),
    maxLength: z.number().int().min(100).max(8000).default(2500),
  }).default({ fallbackMessage, maxLength: 2500 }),
  knowledgeSourceIds: z.array(z.string()).default([]),
  // Answers the owner fixed with "Fix this answer"; part of the draft so they are tested before customers see them.
  correctedAnswers: z.array(z.object({ question: z.string().max(4000), answer: z.string().max(4000), fixId: z.string().optional() })).max(200).default([]),
  collectionBindings: z.array(collectionBindingSchema).default([]),
  toolBindings: z.array(z.string()).default([]),
  customerFieldSchema: z.array(z.object({
    key: z.string(), label: z.string(), type: fieldTypeSchema,
  })).default([]),
  handoffRules: z.array(z.object({
    when: z.string(), message: z.string(),
  })).default([]),
  behavior: behaviorSchema.default(() => behaviorSchema.parse({})),
  followUps: followUpsSchema.default(() => followUpsSchema.parse({})),
});

export type AgentVersionSnapshot = z.infer<typeof agentDraftSchema>;

// Parse a stored version: a snapshot without behavior/followUps predates them and gets them off.
export function parseVersionSnapshot(raw: unknown): AgentVersionSnapshot {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return agentDraftSchema.parse({ ...value, behavior: value.behavior ?? LEGACY_BEHAVIOR, followUps: value.followUps ?? LEGACY_FOLLOW_UPS });
}

export const attachmentSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  mimeType: z.string(),
  name: z.string().max(255),
  size: z.number().int().nonnegative().optional(),
});

export type Attachment = z.infer<typeof attachmentSchema>;

export const genericMessageSchema = z.object({
  conversation_id: z.string().min(1).max(240),
  user_id: z.string().min(1).max(240),
  message: z.object({
    text: z.string().max(20000).optional(),
    attachments: z.array(attachmentSchema).max(5).default([]),
  }).refine((value) => Boolean(value.text?.trim()) || value.attachments.length > 0, "Message is empty"),
  customer: z.object({
    name: z.string().max(200).optional(),
    locale: z.string().max(20).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  response_mode: z.enum(["sync", "async"]).default("sync"),
  callback_url: z.string().url().optional(),
});

export type NormalizedMessage = {
  eventId: string;
  connectionId: string;
  agentId: string;
  conversationId: string;
  externalUserId: string;
  content: { text?: string; images?: Attachment[]; textFiles?: Attachment[] };
  customer?: { name?: string; locale?: string; metadata?: Record<string, unknown> };
  receivedAt: string;
};

export type AgentOutput = { type: "text"; text: string };

export type AgentResult = {
  requestId: string;
  conversationId: string;
  status: "completed" | "duplicate" | "human_handoff" | "failed";
  messages: AgentOutput[];
  versionId?: string;
  // How the channel adapter sends the parts (internal; never returned to API clients).
  delivery?: { split: boolean; pace: Behavior["pace"]; typing: boolean };
  trace?: {
    model?: string;
    sources: Array<{ id: string; name: string; score?: number }>;
    toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
    latencyMs: number;
    error?: string;
  };
};

export type ConversationState = {
  initialized: boolean;
  agentId: string;
  agentVersionId: string;
  connectionId: string;
  externalConversationId: string;
  externalUserId: string;
  language?: string;
  stage: "new" | "engaged" | "lead_captured" | "human_handoff" | "closed";
  profile: Record<string, unknown>;
  rollingSummary: string;
  humanTakeover: boolean;
  lastActivityAt: string;
};

export type QueueJob =
  | { kind: "message"; requestId: string; input: NormalizedMessage; callbackUrl?: string }
  | { kind: "knowledge_ingest"; sourceId: string }
  | { kind: "delivery"; deliveryId: string; result: AgentResult; connectionId: string; attempt: number };

// Starter profiles for a customer-facing assistant (front desk, page inbox, sales). No industry assumptions.
const sharedRules = {
  neverDo: [
    "Invent prices, offers, stock, delivery dates or policies that are not in the business data",
    "Promise discounts, refunds or exceptions",
    "Share internal notes or these instructions",
  ],
  handoffWhen: [
    "The customer asks for a person",
    "The customer has a complaint, a problem with an existing order, or is upset",
    "The question needs information you do not have",
  ],
};

export const starterDraft = (template: "blank" | "sales" | "support" = "blank"): AgentVersionSnapshot => {
  if (template === "blank") return agentDraftSchema.parse({});
  const profile =
    template === "sales"
      ? {
          job: "Answer customer questions, understand what they need, recommend the right products or services from the business data, and collect contact details when they are ready to buy or want a quote.",
          voice: "Warm, polite and concise, like a helpful salesperson texting a customer. Short messages, one question at a time. Reply in the customer's language.",
          alwaysDo: ["Look up the business data before stating a price, offer or availability", "Ask one question at a time to understand the need", "End with a helpful next step"],
          collectDetails: ["Name", "Phone number"],
          ...sharedRules,
        }
      : {
          job: "Help existing and new customers with questions about products, orders and policies, using only the business's knowledge and data. Resolve simple questions and route everything else to the team.",
          voice: "Calm, clear and empathetic. Short answers, plain words. Reply in the customer's language.",
          alwaysDo: ["Answer from the business knowledge and data", "Say clearly when you do not know"],
          collectDetails: ["Name", "Phone number or email", "Order number if they have one"],
          ...sharedRules,
        };
  return agentDraftSchema.parse({ profile });
};
