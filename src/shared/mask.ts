// Customer messages copied into scenarios and fixes never keep phone numbers or emails (PRD 7.3).
// A phone keeps only its last 4 digits so the owner can still recognise it: "•••• 1111".
const phonePattern = /\+?\(?\d[\d ().-]{6,}\d/g;
const emailPattern = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi;

export function maskContact(text: string) {
  return text
    .replace(emailPattern, (_, domain: string) => `••••@${domain}`)
    .replace(phonePattern, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 7 ? `•••• ${digits.slice(-4)}` : match;
    });
}
