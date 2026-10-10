// Pure helpers shared by pages; kept dependency-free so they are unit-tested in Node.

// New rows get the next code in the dominant existing pattern (OF-008 -> OF-009) so owners never invent IDs.
export function nextKey(existing: string[]) {
  const numbered = existing.map((value) => value.match(/^(.*?)(\d+)$/)).filter(Boolean) as RegExpMatchArray[];
  if (!numbered.length) return `R-${Date.now().toString(36).toUpperCase()}`;
  const counts = new Map<string, number>();
  for (const match of numbered) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  const prefix = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const same = numbered.filter((match) => match[1] === prefix);
  const width = Math.max(...same.map((match) => match[2].length));
  const max = Math.max(...same.map((match) => Number(match[2])));
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

// Conversation previews are cut at a fixed length, so structured replies may no longer be valid JSON.
export function previewSnippet(value: string | null | undefined, parse: (text: string) => Array<{ text?: string }>) {
  if (!value) return "—";
  const quoted = value.trimStart().startsWith("{") ? value.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/)?.[1] : undefined;
  if (quoted) return quoted.replace(/\\n/g, " ").replace(/\\"/g, '"');
  return parse(value).find((part) => part.text)?.text ?? "Sent an image";
}

type FieldLike = { key: string; type: string; required?: boolean };

// The column that names a row: first required text column, else the first text column (never the code).
export function titleField<T extends FieldLike>(fields: T[]) {
  const usable = fields.filter((field) => field.key !== "id" && field.type === "text");
  return usable.find((field) => field.required) ?? usable[0];
}
