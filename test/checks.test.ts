import { describe, expect, it } from "vitest";
import { fallbackChecks, mentionsPrice } from "../src/shared/checks";

describe("fallbackChecks", () => {
  it("keeps numbers the right answer has and the wrong one lacks", () => {
    expect(fallbackChecks("Free delivery from 6 chairs, $100 off each", "Free delivery from 6 chairs").mustInclude).toEqual(["$100"]);
    expect(fallbackChecks("We open at 9", "We open at 9").mustInclude).toEqual([]);
    expect(fallbackChecks("Dạ ghế Cyber Carbon S3 giá $4150 ạ.", "Xin lỗi").mustInclude).toEqual(["$4150"]);
    expect(fallbackChecks("Giảm 10% cho đơn từ 6 ghế, tổng 12.", "Có giảm").mustInclude).toEqual(["10%", "12"]);
  });
});

describe("mentionsPrice", () => {
  it("spots prices and offers in English and Vietnamese", () => {
    expect(mentionsPrice("It costs $3,290")).toBe(true);
    expect(mentionsPrice("Bên em đang có ưu đãi free giao hàng")).toBe(true);
    expect(mentionsPrice("Showroom mở cửa 10:00–18:00")).toBe(false);
  });
});
