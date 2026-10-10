import { describe, expect, it } from "vitest";
import { maskContact } from "../src/shared/mask";

describe("maskContact", () => {
  it("hides phones and emails but keeps the rest", () => {
    expect(maskContact("Gọi mình 0901 234 567 nhé")).toBe("Gọi mình •••• 4567 nhé");
    expect(maskContact("Call (215) 772-1111 or mail lan.nguyen@example.com")).toBe("Call •••• 1111 or mail ••••@example.com");
    expect(maskContact("+84 90 123 4567")).toBe("•••• 4567");
  });
  it("leaves prices, counts and short numbers alone", () => {
    expect(maskContact("8 ghế giá $3,290, giảm 10%")).toBe("8 ghế giá $3,290, giảm 10%");
    expect(maskContact("Order 12345")).toBe("Order 12345");
  });
});
