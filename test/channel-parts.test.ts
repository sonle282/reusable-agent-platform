import { describe, expect, it } from "vitest";
import { channelParts } from "../src/shared/channel-parts";

describe("channelParts", () => {
  it("sends plain replies as one text part", () => {
    expect(channelParts("Dạ có ạ")).toEqual([{ kind: "text", text: "Dạ có ạ" }]);
  });
  it("unwraps structured replies into text and images, writing link buttons out", () => {
    const reply = JSON.stringify({
      version: "v2",
      content: { messages: [{ type: "image", url: "https://mrspainc.com/a.webp" }, { type: "text", text: "Mẫu X4 ạ", buttons: [{ type: "url", caption: "Xem mẫu này", url: "https://mrspainc.com/products/x4" }] }] },
      meta: { stage: "dang_quan_tam" },
    });
    expect(channelParts(reply)).toEqual([
      { kind: "image", url: "https://mrspainc.com/a.webp" },
      { kind: "text", text: "Mẫu X4 ạ\nXem mẫu này: https://mrspainc.com/products/x4" },
    ]);
  });
  it("never forwards the internal meta or non-https links", () => {
    const reply = JSON.stringify({ content: { messages: [{ type: "image", url: "http://insecure/a.png" }, { type: "text", text: "Hi" }] }, meta: { lead_phone: "0901" } });
    expect(channelParts(reply)).toEqual([{ kind: "text", text: "Hi" }]);
  });
});

describe("splitParts and paceDelay", () => {
  it("splits paragraphs into at most three messages and paces them", async () => {
    const { splitParts, paceDelay } = await import("../src/shared/channel-parts");
    const text = ["One.", "Two.", "Three.", "Four."].join("\n\n");
    const parts = splitParts([{ kind: "text", text }]);
    expect(parts).toHaveLength(2);
    expect(splitParts([{ kind: "text", text: "Only one" }])).toHaveLength(1);
    expect(splitParts([{ kind: "text", text: "a\n\nb\n\nc" }]).map((part) => (part.kind === "text" ? part.text : ""))).toEqual(["a", "b", "c"]);
    expect(paceDelay("instant", parts[0])).toBe(0);
    expect(paceDelay("natural", { kind: "text", text: "x" })).toBe(1000);
    expect(paceDelay("natural", { kind: "text", text: "x".repeat(500) })).toBe(3000);
  });
});
