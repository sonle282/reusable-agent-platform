// Dependency-free so the admin UI can import it without bundling zod.
export const anthropicModels = [
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-haiku-5-5",
  "claude-sonnet-5",
  "claude-opus-5",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
] as const;

export type AnthropicModel = (typeof anthropicModels)[number];

// Claude 5-generation models reject non-default sampling parameters with a 400.
const samplingModels = new Set<string>(["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]);
export const modelSupportsTemperature = (model: string) => samplingModels.has(model);
