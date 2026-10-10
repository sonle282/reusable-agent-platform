import type { AnthropicModel } from "../shared/models";

export type Brand = {
  name: string;
  logoUrl: string;
  primaryColor: string;
  supportUrl: string;
};

export type Tool = {
  id: string;
  name: string;
  description: string;
  kind: "http_get" | "plugin";
  status: string;
};

export type KnowledgeSource = {
  id: string;
  name: string;
  type: string;
  status: string;
  error?: string | null;
  updated_at?: string;
};

export type EvalCase = {
  id: string;
  name: string;
  input: string;
  assertions_json: string;
  critical: number;
};

export type AgentDraft = {
  instructions: string;
  modelConfig: {
    model: AnthropicModel;
    credentialId?: string | null;
    accountId?: string | null;
    gatewayId?: string | null;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
  responsePolicy: { fallbackMessage: string; maxLength: number };
  knowledgeSourceIds: string[];
  collectionBindings: Array<{ collectionId: string; toolName: string; purpose: string }>;
  toolBindings: string[];
  customerFieldSchema: unknown[];
  handoffRules: unknown[];
};

export type AgentSummary = {
  id: string;
  name: string;
  description: string;
  primary_language?: string;
  status: string;
  active_version_id?: string | null;
  updated_at?: string;
};

export type AgentDetail = AgentSummary & {
  draft: AgentDraft;
  versions: Array<{ id: string; version: number; published_at: string }>;
  sources: KnowledgeSource[];
  tools: Tool[];
  evalCases: EvalCase[];
};

export type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  schema_json: string;
  updated_at?: string;
};

export type Connection = {
  id: string;
  agent_id: string;
  type: "generic_api" | "generic_webhook" | "zernio" | string;
  name: string;
  status: string;
  callback_url?: string | null;
  config_json: string;
  created_at?: string;
};

export type Bootstrap = {
  brand: Brand;
  modelDefaults: Record<string, unknown>;
  agents: AgentSummary[];
  collections: Collection[];
  connections: Connection[];
};

export type Conversation = {
  id: string;
  agent_id: string;
  connection_id?: string;
  external_user_id: string;
  external_conversation_id?: string;
  display_name?: string | null;
  phone?: string | null;
  email?: string | null;
  stage: string;
  human_takeover: number;
  last_message_preview: string;
  last_activity_at: string;
};

export type TranscriptMessage = { id: string; role: string; content: string; created_at: string };

export type AgentResult = {
  requestId: string;
  status: string;
  messages: Array<{ text: string }>;
  versionId?: string;
  trace?: {
    model?: string;
    latencyMs: number;
    sources: Array<{ name: string; score?: number }>;
    toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
    error?: string;
  };
};

export type EvalRun = {
  id: string;
  passed: boolean;
  results: Array<{ caseId: string; passed: boolean; failures: string[]; output: AgentResult }>;
};

export type Delivery = {
  id: string;
  connection_id: string;
  request_id: string;
  status: string;
  attempts: number;
  last_error?: string | null;
  updated_at: string;
};

export type Dashboard = {
  conversations: { count: number } | null;
  errors: { count: number } | null;
  latency: { value: number | null } | null;
  deliveries: { count: number } | null;
};
