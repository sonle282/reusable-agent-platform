// Which language a customer's message is in, when it is clear: Vietnamese (its letters) or English (common words).
// Knowledge and data are often Vietnamese, which pulls the model into Vietnamese; a detected language becomes a
// strict instruction. Anything else (no letters, Vietnamese typed without accents, other languages) returns null.
const VIETNAMESE = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const ENGLISH = /\b(the|a|an|is|are|do|does|did|you|your|have|has|how|what|which|when|where|can|could|would|price|much|many|chair|chairs|i|i'm|my|we|our|please|thanks|thank|hello|hi|any|want|need)\b/gi;

export type ReplyLanguage = "Vietnamese" | "English";

export function messageLanguage(text: string): ReplyLanguage | null {
  if (VIETNAMESE.test(text)) return "Vietnamese";
  const english = text.match(ENGLISH)?.length ?? 0;
  const words = text.match(/\p{L}+/gu)?.length ?? 0;
  return words > 0 && english >= Math.min(2, words) ? "English" : null;
}
