import type { Connection } from "./types";

// Which platform a channel or lead comes from, as a BrandLogo key. Zernio channels carry the connected account's platform.
const marks: Record<string, string> = {
  facebook: "messenger",
  messenger: "messenger",
  instagram: "instagram",
  whatsapp: "whatsapp",
  telegram: "telegram",
  tiktok: "tiktok",
  twitter: "x",
  x: "x",
  imessage: "imessage",
  bluesky: "bluesky",
  reddit: "reddit",
  zernio: "messenger",
  generic_api: "api",
  generic_webhook: "webhook",
};

export const platformName: Record<string, string> = {
  messenger: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  tiktok: "TikTok",
  x: "X",
  imessage: "iMessage",
  bluesky: "Bluesky",
  reddit: "Reddit",
  api: "API",
  webhook: "Webhook",
};

export function platformKey(value?: string | null) {
  return (value && marks[value.toLowerCase()]) || "api";
}

export function platformOf(connection?: Connection | null) {
  if (!connection) return "api";
  if (connection.type !== "zernio") return platformKey(connection.type);
  try {
    return platformKey((JSON.parse(connection.config_json || "{}") as { platform?: string }).platform ?? "zernio");
  } catch {
    return "messenger";
  }
}
