import { describe, expect, it } from "vitest";
import { messageLanguage } from "../src/shared/language";

describe("language of a customer's message", () => {
  it("knows Vietnamese by its letters", () => {
    expect(messageLanguage("Ghế Relaxo giá sao em?")).toBe("Vietnamese");
    expect(messageLanguage("Có trả góp không")).toBe("Vietnamese");
  });
  it("knows English by common words", () => {
    expect(messageLanguage("How much is the MS1 chair?")).toBe("English");
    expect(messageLanguage("Do you deliver on weekends?")).toBe("English");
    expect(messageLanguage("price?")).toBe("English");
  });
  it("stays unsure when it can't tell", () => {
    expect(messageLanguage("ghe nay gia bao nhieu")).toBeNull();
    expect(messageLanguage("👍")).toBeNull();
    expect(messageLanguage("215-772-1111")).toBeNull();
  });
});
