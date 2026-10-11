import { describe, expect, it } from "vitest";
import { channelParts } from "../src/shared/channel-parts";
import { hasImageField, lookupLinks, takeImageLines, withImages } from "../src/shared/media";

const offer = { id: "OF-010", title: "RELAXO $2,095", image_url: "https://cdn.example.com/of-010.webp", page_url: "https://shop.example.com/relaxo" };

describe("photos from Data rows", () => {
  it("keeps only links that came back from lookups", () => {
    const allowed = lookupLinks([[offer]]);
    const result = takeImageLines("Dạ ưu đãi RELAXO đang $2,095 ạ.\nIMAGE: https://cdn.example.com/of-010.webp\nIMAGE: https://evil.example.com/x.png", allowed);
    expect(result).toEqual({ text: "Dạ ưu đãi RELAXO đang $2,095 ạ.", images: ["https://cdn.example.com/of-010.webp"] });
  });
  it("sends text and photo as separate channel parts", () => {
    const reply = withImages("Dạ ưu đãi RELAXO ạ.", ["https://cdn.example.com/of-010.webp"]);
    expect(channelParts(reply)).toEqual([
      { kind: "text", text: "Dạ ưu đãi RELAXO ạ." },
      { kind: "image", url: "https://cdn.example.com/of-010.webp" },
    ]);
    expect(withImages("plain", [])).toBe("plain");
  });
  it("binds the rule only for tables with a photo column", () => {
    expect(hasImageField([{ key: "id", type: "text" }, { key: "picture", type: "image_url" }])).toBe(true);
    expect(hasImageField([{ key: "image_url", type: "url" }])).toBe(true);
    expect(hasImageField([{ key: "id", type: "text" }, { key: "title", type: "text" }])).toBe(false);
  });
});
