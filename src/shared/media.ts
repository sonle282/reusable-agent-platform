// Photos from Data rows: the assistant writes "IMAGE: <link>" on its own line; only links that came back from
// this turn's lookups are kept, so a reply can never carry an address the model made up.

export const IMAGE_RULE =
  'PHOTOS: whenever your reply is about a specific product or offer from this turn\'s lookup results and that row has an image link, show its photo without being asked: add a line "IMAGE: " followed by that link. Only use links from lookup results, at most 2 per reply.';

const IMAGE_LINE = /^[ \t]*IMAGE:[ \t]*(\S+)[ \t]*$/gim;

// Every https link anywhere in the lookup output.
export function lookupLinks(outputs: unknown[]): Set<string> {
  const links = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      if (/^https:\/\/\S+$/.test(value.trim())) links.add(value.trim());
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  outputs.forEach(walk);
  return links;
}

export function takeImageLines(answer: string, allowed: Set<string>): { text: string; images: string[] } {
  const images: string[] = [];
  const text = answer
    .replace(IMAGE_LINE, (_, link: string) => {
      if (allowed.has(link) && !images.includes(link) && images.length < 2) images.push(link);
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, images };
}

// A reply with photos goes out in the structured format the channels and Preview already understand.
export function withImages(text: string, images: string[]) {
  if (!images.length) return text;
  return JSON.stringify({ version: "v2", content: { messages: [{ type: "text", text }, ...images.map((url) => ({ type: "image", url }))] } });
}

// Bind the rule only when a lookup table has a photo column (an image_url field, or a key named like one).
export const hasImageField = (fields: Array<{ key: string; type?: string }>) => fields.some((field) => field.type === "image_url" || /^(image|image_url|photo|photo_url)$/i.test(field.key));
