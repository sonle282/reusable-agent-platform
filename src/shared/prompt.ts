// Builds the assistant's system prompt from the owner-editable profile plus the optional
// detailed playbook. Industry-agnostic: every business fills the same sections.

export type AssistantProfile = {
  businessName: string;
  offering: string;
  contactInfo: string;
  website: string;
  job: string;
  voice: string;
  alwaysDo: string[];
  neverDo: string[];
  handoffWhen: string[];
  collectDetails: string[];
  // Said once before the first request for contact details (PDPA / Vietnam PDP law: tell people why before collecting).
  consentNotice: string;
};

export const emptyProfile: AssistantProfile = {
  businessName: "",
  offering: "",
  contactInfo: "",
  website: "",
  job: "",
  voice: "",
  alwaysDo: [],
  neverDo: [],
  handoffWhen: [],
  collectDetails: [],
  consentNotice: "",
};

type PromptSource = { profile?: Partial<AssistantProfile>; instructions?: string; correctedAnswers?: Array<{ question: string; answer: string }> };

const list = (items?: string[]) => (items ?? []).map((item) => item.trim()).filter(Boolean);

export function hasProfile(source: PromptSource) {
  const profile = { ...emptyProfile, ...source.profile };
  return Boolean(profile.job.trim() || profile.businessName.trim() || profile.offering.trim() || list(profile.alwaysDo).length || list(profile.neverDo).length);
}

export function composeSystemPrompt(source: PromptSource) {
  const profile = { ...emptyProfile, ...source.profile };
  const sections: string[] = [];
  const business = [
    profile.businessName.trim() && `Name: ${profile.businessName.trim()}`,
    profile.offering.trim() && `What it offers: ${profile.offering.trim()}`,
    profile.contactInfo.trim() && `Contact and hours: ${profile.contactInfo.trim()}`,
    profile.website.trim() && `Website: ${profile.website.trim()}`,
  ].filter(Boolean);
  if (business.length) sections.push(`# BUSINESS\n${business.join("\n")}`);
  if (profile.job.trim()) sections.push(`# YOUR JOB\nYou talk to the business's customers on its behalf, like a trained staff member.\n${profile.job.trim()}`);
  if (profile.voice.trim()) sections.push(`# VOICE AND STYLE\n${profile.voice.trim()}`);
  const always = list(profile.alwaysDo);
  if (always.length) sections.push(`# ALWAYS\n${always.map((item) => `- ${item}`).join("\n")}`);
  const never = list(profile.neverDo);
  if (never.length) sections.push(`# NEVER\n${never.map((item) => `- ${item}`).join("\n")}`);
  const handoff = list(profile.handoffWhen);
  if (handoff.length)
    sections.push(`# HAND OFF TO A PERSON WHEN\n${handoff.map((item) => `- ${item}`).join("\n")}\nWhen handing off: acknowledge the customer, ask for their contact details if you do not have them, and say a staff member will follow up.`);
  const details = list(profile.collectDetails);
  if (details.length) sections.push(`# CONTACT DETAILS TO COLLECT\nWhen the customer is ready to buy, asks for a quote, or needs a person, politely ask for: ${details.join(", ")}. Never insist and never ask for what you already have.${profile.consentNotice.trim() ? `
The first time you ask, first tell the customer this, in their language and briefly: "${profile.consentNotice.trim()}"` : ""}`);
  const corrected = (source.correctedAnswers ?? []).filter((item) => item.question.trim() && item.answer.trim());
  if (corrected.length)
    sections.push(
      `# CORRECTED ANSWERS\nThe owner corrected these answers. When a customer asks something with the same meaning, give the same facts, in the customer's language and your own words. These facts count as checked.\n${corrected.map((item) => `Q: ${item.question.trim()}\nA: ${item.answer.trim()}`).join("\n\n")}`,
    );
  const playbook = source.instructions?.trim();
  if (playbook) {
    if (sections.length) sections.push(`# DETAILED PLAYBOOK\nThe rules above were written by the business owner and win whenever the playbook below disagrees with them.\n\n${playbook}`);
    else sections.push(playbook);
  }
  return sections.join("\n\n");
}

// Runtime rules that depend on the reply layout. Kept here so they can be tested without a model call.
export const FORMAT_RULE =
  "FORMAT: plain text laid out for a phone screen. Put each price, item, add-on or condition on its own line instead of one long line, and put the question you ask back after a blank line. No markdown symbols (*, #, -, bullets).";

// A Q&A answer from the business is given whole: the sentence limit covers everything else in the reply.
export function lengthRule(maxSentences: number) {
  if (maxSentences <= 0) return "";
  return `LENGTH (strict): the whole reply is at most ${maxSentences} short sentences, counting everything the customer reads (a privacy notice too). Exception: when the customer's question matches a Q&A or FAQ entry in KNOWLEDGE, give every point of that entry's answer, worded as in the Q&A (adapt only the pronouns and the language); never shorten it or drop a clause, and keep anything you add to it within the limit. In Vietnamese, open with "Dạ" inside the first sentence, not as a sentence of its own; in other languages use that language's natural opening, never "Dạ". Keep only what answers this message; put the phone number inside a sentence, not as an extra one. Cut your own extras rather than go over, never part of a Q&A answer.`;
}
