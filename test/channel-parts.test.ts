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
