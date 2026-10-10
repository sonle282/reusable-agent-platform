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
};

type PromptSource = { profile?: Partial<AssistantProfile>; instructions?: string };

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
  if (details.length) sections.push(`# CONTACT DETAILS TO COLLECT\nWhen the customer is ready to buy, asks for a quote, or needs a person, politely ask for: ${details.join(", ")}. Never insist and never ask for what you already have.`);
  const playbook = source.instructions?.trim();
  if (playbook) {
    if (sections.length) sections.push(`# DETAILED PLAYBOOK\nThe rules above were written by the business owner and win whenever the playbook below disagrees with them.\n\n${playbook}`);
    else sections.push(playbook);
  }
  return sections.join("\n\n");
}
