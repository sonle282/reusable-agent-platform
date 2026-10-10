import { z } from "zod";

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

export const anthropicModelSchema = z.enum([
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-haiku-5-5",
  "claude-sonnet-5",
  "claude-opus-5",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);

export type AnthropicModel = z.infer<typeof anthropicModelSchema>;

// Claude 5-generation models reject non-default sampling parameters with a 400.
const samplingModels = new Set<string>(["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]);
export const modelSupportsTemperature = (model: string) => samplingModels.has(model);

export const modelConfigSchema = z.object({
  provider: z.literal("anthropic").default("anthropic"),
  model: anthropicModelSchema.default("claude-sonnet-5"),
  credentialId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  gatewayId: z.string().nullable().optional(),
  temperature: z.number().min(0).max(1).default(0.2),
  maxTokens: z.number().int().min(128).max(8192).default(1200),
  timeoutMs: z.number().int().min(3000).max(90000).default(45000),
});

export const collectionBindingSchema = z.object({
  collectionId: z.string().min(1),
  toolName: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  purpose: z.string().min(1).max(500),
});

export const agentDraftSchema = z.object({
  instructions: z.string().default(""),
  modelConfig: modelConfigSchema.default({ provider: "anthropic", model: "claude-sonnet-5", temperature: 0.2, maxTokens: 1200, timeoutMs: 45000 }),
  responsePolicy: z.object({
    fallbackMessage: z.string().default("Xin lỗi, hiện tôi chưa thể trả lời. Vui lòng thử lại sau."),
    maxLength: z.number().int().min(100).max(8000).default(2500),
  }).default({ fallbackMessage: "Xin lỗi, hiện tôi chưa thể trả lời. Vui lòng thử lại sau.", maxLength: 2500 }),
  knowledgeSourceIds: z.array(z.string()).default([]),
  collectionBindings: z.array(collectionBindingSchema).default([]),
  toolBindings: z.array(z.string()).default([]),
  customerFieldSchema: z.array(z.object({
    key: z.string(), label: z.string(), type: fieldTypeSchema,
  })).default([]),
  handoffRules: z.array(z.object({
    when: z.string(), message: z.string(),
  })).default([]),
});

export type AgentVersionSnapshot = z.infer<typeof agentDraftSchema>;

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

export const starterDraft = (template: "blank" | "sales" | "support" = "blank"): AgentVersionSnapshot => {
  const instructions = template === "sales"
    ? "Bạn là chuyên viên tư vấn. Hỏi ngắn gọn để hiểu nhu cầu, chỉ dùng dữ liệu được cung cấp, không bịa giá hoặc ưu đãi, và xin thông tin liên hệ khi khách đồng ý."
    : template === "support"
      ? "Bạn là nhân viên hỗ trợ. Trả lời rõ ràng từ nguồn được cung cấp, thừa nhận khi chưa biết và chuyển người thật khi vấn đề vượt phạm vi."
      : "";
  return agentDraftSchema.parse({ instructions });
};
