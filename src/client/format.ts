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

type PersonLike = { display_name?: string | null; phone?: string | null; external_user_id?: string | null };

// Owners never see raw ids: contact name, then phone, then "Visitor" + the last 4 characters of the id.
export function displayName(person: PersonLike) {
  const name = person.display_name?.trim();
  if (name) return name;
  const phone = person.phone?.trim();
  if (phone) return phone;
  const id = (person.external_user_id ?? "").replace(/[^a-z0-9]/gi, "");
  return id ? `Visitor ${id.slice(-4).toUpperCase()}` : "Visitor";
}

// D1 returns "YYYY-MM-DD HH:MM:SS" in UTC without a zone; ISO strings pass through.
export function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = /Z|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DAY = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const time = (date: Date) => date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Today "2:39 PM" · "Yesterday" · this week "Tuesday" · older "Oct 3" · other years "Oct 3, 2025".
export function formatDate(value?: string | null, now = new Date()) {
  const date = parseDate(value);
  if (!date) return value ? value : "—";
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days <= 0) return time(date);
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

// Lists where the exact moment matters (versions, updates): "1:16 PM" today, "Yesterday 4:12 PM", "Oct 8, 4:12 PM", "Oct 8, 2025, 4:12 PM".
export function formatWhen(value?: string | null, now = new Date()) {
  const date = parseDate(value);
  if (!date) return value ? value : "—";
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days <= 0) return time(date);
  if (days === 1) return `Yesterday ${time(date)}`;
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
  return `${day}, ${time(date)}`;
}

// Full date and time for a tooltip: "Sunday, October 11, 2026 at 1:16 PM".
export function fullDate(value?: string | null) {
  const date = parseDate(value);
  return date ? `${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at ${time(date)}` : "";
}

// Transcript separator shown before a message when more than 15 minutes passed: "Today 2:39 PM", "Oct 3 9:05 AM".
export function timeSeparator(previous: string | null | undefined, current: string, now = new Date()) {
  const date = parseDate(current);
  if (!date) return null;
  const before = parseDate(previous);
  if (before && date.getTime() - before.getTime() <= 15 * 60_000) return null;
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  const day = days <= 0 ? "Today" : days === 1 ? "Yesterday" : formatDate(current, now);
  return `${day} ${time(date)}`;
}
