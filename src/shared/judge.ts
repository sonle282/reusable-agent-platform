// Reads the AI judge's verdict leniently: code fences, stray text, unescaped quotes in the reason.
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

export function readVerdict(text: string): { pass: boolean; reason: string } | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as { pass?: unknown; reason?: unknown };
      if (typeof parsed.pass === "boolean") return { pass: parsed.pass, reason: clip(String(parsed.reason ?? ""), 200) };
    } catch {
      // fall through to the pattern below
    }
  }
  const pass = text.match(/"?pass"?\s*[:=]\s*(true|false)/i)?.[1];
  if (!pass) return null;
  const reason = text.match(/"?reason"?\s*[:=]\s*"([^\n]*?)"\s*\}?\s*$/im)?.[1] ?? "";
  return { pass: pass.toLowerCase() === "true", reason: clip(reason, 200) };
}
