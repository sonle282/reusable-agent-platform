import { describe, expect, it } from "vitest";
import { fallbackChecks, mentionsPrice, unsourcedAmounts } from "../src/shared/checks";

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

describe("prices the sources never gave", () => {
  const knowledge = "Drain pump chỉ $99/cái khi mua kèm ghế pedicure (giá gốc $179). Đơn trên $5,000 giảm 5%; trên $10,000 giảm 10%.";
  it("accepts amounts that appear in knowledge, whatever the formatting", () => {
    expect(unsourcedAmounts("Dạ drain pump chỉ $99 thôi ạ, đơn trên $5000 giảm 5 %.", [knowledge])).toEqual([]);
  });
  it("flags an amount nobody gave", () => {
    expect(unsourcedAmounts("Dạ ghế này $2,450 ạ.", [knowledge])).toEqual(["2450"]);
    expect(unsourcedAmounts("Giảm 15% cho anh/chị.", [knowledge])).toEqual(["15%"]);
  });
  it("ignores replies without numbers", () => {
    expect(unsourcedAmounts("Dạ bên em có ưu đãi, anh/chị để lại số giúp em nhé.", [knowledge])).toEqual([]);
  });
});
