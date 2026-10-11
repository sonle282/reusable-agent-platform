// Contact details found in a customer message, and the one-line lead summary the assistant appends.

const VN_PHONE = /(?:\+?84|0)(?:\d[ .-]?){8,10}\d/;
// US/Canada: (346) 555-0142, 346-555-0142, 346.555.0142, +1 346 555 0142, 3465550142.
const US_PHONE = /(?<![\d])(?:\+?1[ .-]?)?\(?[2-9]\d{2}\)?[ .-]?\d{3}[ .-]?\d{4}(?![\d])/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function findContact(text: string): { phone?: string; email?: string } {
  const raw = text.match(VN_PHONE)?.[0] ?? text.match(US_PHONE)?.[0];
  const phone = raw ? raw.replace(/[^+\d]/g, "") : undefined;
  const email = text.match(EMAIL)?.[0];
  return { ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
}

// Asked for only on the turn a customer shares contact details; never reaches the customer.
export const LEAD_LINE_RULE =
  'The customer just shared contact details. After your reply, add one last line that starts with "LEAD:" and sums up what they want in one short line in the customer\'s language (what, how many, where). The customer never sees that line.';

const LEAD_LINE = /^[ \t]*LEAD:[ \t]*(.*)$/gim;

export function takeLeadLine(answer: string): { text: string; summary: string } {
  let summary = "";
  const text = answer
    .replace(LEAD_LINE, (_, line: string) => {
      summary = line.trim();
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, summary: summary.slice(0, 200) };
}

// 3465550142 → (346) 555-0142; anything else stays as stored.
export function formatPhone(value?: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return us.length === 10 && !value.startsWith("+84") && !value.startsWith("0") ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : value;
}

// Did this reply already carry the privacy notice? The model rewords it, so compare words, not the exact sentence.
export function mentionsNotice(reply: string, notice: string) {
  const words = (text: string) => text.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 2);
  const wanted = new Set(words(notice));
  if (wanted.size === 0) return false;
  const seen = new Set(words(reply));
  let hits = 0;
  for (const word of wanted) if (seen.has(word)) hits++;
  return hits / wanted.size >= 0.7;
}
