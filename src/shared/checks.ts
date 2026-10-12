// Pure checks used by the runtime and by Fix this answer; kept here so they are unit-tested in Node.

// Numbers and prices the right answer has but the wrong one lacks are the cheapest reliable check.
export function fallbackChecks(correct: string, bad: string) {
  // Standalone numbers only ("$4150", "6", "10%"), never digits inside a name like "S3"; prices and long numbers first.
  const tokens = [...new Set(correct.match(/(?<![\p{L}\d])[$€£₫]?\d[\d.,]*%?(?![\p{L}\d])/gu) ?? [])]
    .map((token) => token.replace(/[.,]$/, ""))
    .filter((token) => !bad.includes(token))
    .sort((a, b) => Number(/[$€£₫%]/.test(b)) - Number(/[$€£₫%]/.test(a)) || b.length - a.length);
  return { mustInclude: tokens.slice(0, 2), mustNotInclude: [] as string[] };
}

// Flags replies that state a price or offer without looking anything up (Needs attention: "Price given without checking Data").
// Money amounts and percentages in a reply ("$1,495", "1495 USD", "5%") that none of the sources contain.
// Used to flag "price given without checking": a number the owner's data and instructions never gave.
const AMOUNT = /\$\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:usd|dollars?)\b|\d+(?:[.,]\d+)?\s?%/gi;
const amountKey = (value: string) => (value.includes("%") ? `${value.replace(/[^\d.,]/g, "").replace(",", ".")}%` : value.replace(/[^\d.]/g, "").replace(/\.0+$/, ""));
export function unsourcedAmounts(answer: string, sources: string[]) {
  const known = new Set(sources.flatMap((text) => [...text.matchAll(AMOUNT)].map((match) => amountKey(match[0]))));
  return [...answer.matchAll(AMOUNT)].map((match) => amountKey(match[0])).filter((key) => key && key !== "%" && !known.has(key));
}

export function mentionsPrice(text: string) {
  return /[$€£¥₫]\s?\d|\d[\d.,]*\s?(?:usd|vnd|đ|dollars?)\b|\b(?:price|discount|offer|% off)\b|giá|giảm|ưu đãi|khuyến mãi|miễn phí|free ship/i.test(text);
}
