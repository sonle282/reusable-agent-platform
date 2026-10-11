// Some playbooks answer with a structured payload ({"version":"v2","content":{"messages":[...]}}).
// Channels such as Messenger need plain parts: text (with any link buttons written out) and images.
export type ChannelPart = { kind: "text"; text: string } | { kind: "image"; url: string };

type RichPart = { type?: string; text?: string; url?: string; buttons?: Array<{ caption?: string; url?: string }> };

const httpsUrl = (value?: string) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

export function channelParts(reply: string): ChannelPart[] {
  const trimmed = reply.trim();
  let rich: RichPart[] | undefined;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { content?: { messages?: RichPart[] } };
      if (Array.isArray(parsed.content?.messages)) rich = parsed.content.messages;
    } catch {
      // Not a structured payload; send it as written.
    }
  }
  if (!rich) return trimmed ? [{ kind: "text", text: trimmed }] : [];
  const parts: ChannelPart[] = [];
  for (const item of rich) {
    const image = item.type === "image" ? httpsUrl(item.url) : undefined;
    if (image) parts.push({ kind: "image", url: image });
    const links = (item.buttons ?? []).map((button) => ({ caption: button.caption || "Link", url: httpsUrl(button.url) })).filter((button) => button.url);
    const text = [item.text?.trim(), ...links.map((button) => `${button.caption}: ${button.url}`)].filter(Boolean).join("\n");
    if (text) parts.push({ kind: "text", text });
  }
  return parts;
}

// "Split long replies": a plain-text part with paragraphs becomes up to 3 short messages, like a person texting.
export function splitParts(parts: ChannelPart[], max = 3): ChannelPart[] {
  return parts.flatMap((part): ChannelPart[] => {
    if (part.kind !== "text") return [part];
    const paragraphs = part.text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    if (paragraphs.length <= 1) return [part];
    const size = Math.ceil(paragraphs.length / max);
    const chunks: string[] = [];
    for (let index = 0; index < paragraphs.length; index += size) chunks.push(paragraphs.slice(index, index + size).join("\n\n"));
    return chunks.map((text) => ({ kind: "text" as const, text }));
  });
}

// Wait before each message after the first: natural is 1–3 s depending on length, slow 2–5 s.
export function paceDelay(pace: "instant" | "natural" | "slow", part: ChannelPart) {
  if (pace === "instant") return 0;
  const length = part.kind === "text" ? part.text.length : 40;
  return pace === "slow" ? Math.min(5000, Math.max(2000, 1500 + length * 40)) : Math.min(3000, Math.max(1000, 600 + length * 25));
}
