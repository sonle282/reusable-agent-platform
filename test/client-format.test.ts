import { describe, expect, it } from "vitest";
import { nextKey, previewSnippet } from "../src/client/format";
import { parseRichMessage } from "../src/client/RichMessage";

describe("nextKey", () => {
  it("continues the dominant code pattern", () => {
    expect(nextKey(["U003", "OF-001", "OF-008", "OF-002", "U001"])).toBe("OF-009");
  });
  it("keeps zero padding", () => {
    expect(nextKey(["P009"])).toBe("P010");
  });
  it("falls back to a generated code", () => {
    expect(nextKey([])).toMatch(/^R-/);
  });
});

describe("previewSnippet", () => {
  it("reads text from a truncated structured reply", () => {
    const truncated = '{"version":"v2","content":{"messages":[{"type":"text","text":"Dạ ghế \\"M4\\" bảo hành\\n12 thá';
    expect(previewSnippet(truncated, parseRichMessage)).toBe('Dạ ghế "M4" bảo hành 12 thá');
  });
  it("keeps plain text", () => {
    expect(previewSnippet("Xin chào", parseRichMessage)).toBe("Xin chào");
  });
});

describe("titleField", () => {
  it("prefers the first required text column over a type column", async () => {
    const { titleField } = await import("../src/client/format");
    const fields = [
      { key: "id", type: "text", required: true },
      { key: "kind", type: "text" },
      { key: "title", type: "text", required: true },
    ];
    expect(titleField(fields)?.key).toBe("title");
  });
});
