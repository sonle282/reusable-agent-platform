import { describe, expect, it } from "vitest";
import { displayName, formatDate, nextKey, previewSnippet, timeSeparator } from "../src/client/format";
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

describe("displayName", () => {
  it("prefers name, then phone, then a short visitor label", () => {
    expect(displayName({ display_name: "Lan", phone: "0901", external_user_id: "abc" })).toBe("Lan");
    expect(displayName({ display_name: " ", phone: "0901 234 567", external_user_id: "abc" })).toBe("0901 234 567");
    expect(displayName({ external_user_id: "preview-7f3a9c2e" })).toBe("Visitor 9C2E");
    expect(displayName({})).toBe("Visitor");
  });
});

describe("formatDate", () => {
  const now = new Date(2026, 9, 10, 15, 0);
  const at = (d: Date) => d.toISOString();
  it("follows the today / yesterday / weekday / date rules", () => {
    expect(formatDate(at(new Date(2026, 9, 10, 14, 39)), now)).toBe("2:39 PM");
    expect(formatDate(at(new Date(2026, 9, 9, 8, 0)), now)).toBe("Yesterday");
    expect(formatDate(at(new Date(2026, 9, 6, 8, 0)), now)).toBe("Tuesday");
    expect(formatDate(at(new Date(2026, 9, 3, 8, 0)), now)).toBe("Oct 3");
    expect(formatDate(at(new Date(2025, 9, 3, 8, 0)), now)).toBe("Oct 3, 2025");
    expect(formatDate(null, now)).toBe("—");
  });
  it("adds a transcript separator only after a 15 minute gap", () => {
    const a = at(new Date(2026, 9, 10, 14, 39));
    expect(timeSeparator(null, a, now)).toBe("Today 2:39 PM");
    expect(timeSeparator(a, at(new Date(2026, 9, 10, 14, 50)), now)).toBeNull();
    expect(timeSeparator(a, at(new Date(2026, 9, 10, 15, 0)), now)).toBe("Today 3:00 PM");
  });
});

describe("readable fix reply", async () => {
  const { readable } = await import("../src/client/FixSheet");
  it("shows only the customer-facing text of structured replies", () => {
    const payload = JSON.stringify({ version: "v2", content: { messages: [{ type: "text", text: "Dạ thứ Bảy mở theo hẹn ạ." }] }, meta: { stage: "new" } });
    expect(readable(payload)).toBe("Dạ thứ Bảy mở theo hẹn ạ.");
    expect(readable(`${payload}\n${payload}`)).toBe("Dạ thứ Bảy mở theo hẹn ạ.\nDạ thứ Bảy mở theo hẹn ạ.");
    expect(readable("Plain answer")).toBe("Plain answer");
  });
});
