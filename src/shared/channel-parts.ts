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
