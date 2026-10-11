// Agents may answer with a structured channel payload ({version:"v2",content:{messages:[...]}}).
// Render it as the customer would see it; fall back to plain text for anything else.
type RichPart = {
  type: string;
  text?: string;
  url?: string;
  buttons?: Array<{ type?: string; caption?: string; url?: string }>;
};

export function parseRichMessage(text: string): RichPart[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { content?: { messages?: RichPart[] } };
      const parts = parsed.content?.messages;
      if (Array.isArray(parts) && parts.length) return parts;
    } catch {
      // Not structured output; render as text.
    }
  }
  return [{ type: "text", text }];
}

const safeUrl = (value?: string) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

// ChatGPT-style thread: the customer is a gray bubble on the right, the assistant (or team) plain text on the left.
export function RichBubbles({ text, side }: { text: string; side: "customer" | "assistant" }) {
  return (
    <>
      {parseRichMessage(text).map((part, index) => {
        const buttons = (part.buttons ?? []).filter((button) => safeUrl(button.url));
        const image = part.type === "image" ? safeUrl(part.url) : undefined;
        return (
          <div className={`${side === "customer" ? "msg-user" : "msg-ai-text"}${image ? " has-media" : ""}`} key={index}>
            {image && <img className="msg-image" src={image} alt="" loading="lazy" />}
            {part.text && <p className="msg-text">{part.text}</p>}
            {buttons.length > 0 && (
              <div className="row-flex" style={{ flexWrap: "wrap" }}>
                {buttons.map((button, buttonIndex) => (
                  <a className="msg-chip" href={safeUrl(button.url)} target="_blank" rel="noreferrer noopener" key={buttonIndex}>
                    {button.caption || "Open link"}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
