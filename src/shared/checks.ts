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
export function mentionsPrice(text: string) {
  return /[$€£¥₫]\s?\d|\d[\d.,]*\s?(?:usd|vnd|đ|dollars?)\b|\b(?:price|discount|offer|% off)\b|giá|giảm|ưu đãi|khuyến mãi|miễn phí|free ship/i.test(text);
}
