import { describe, expect, it } from "vitest";
import { findContact, formatPhone, takeLeadLine } from "../src/shared/contact";

describe("findContact", () => {
  it("finds Vietnamese and US phone numbers and emails", () => {
    expect(findContact("Anh tên Test, số 0900000000")).toEqual({ phone: "0900000000" });
    expect(findContact("call me at (346) 555-0142 please")).toEqual({ phone: "3465550142" });
    expect(findContact("+1 267.555.0170")).toEqual({ phone: "+12675550170" });
    expect(findContact("mai.le@example.com")).toEqual({ email: "mai.le@example.com" });
  });
  it("ignores prices, quantities and model numbers", () => {
    expect(findContact("6 ghế, giá $1,700 – $4,000")).toEqual({});
    expect(findContact("Birkin M4 x 8, order 2026")).toEqual({});
  });
});

describe("takeLeadLine", () => {
  it("strips the lead line and returns the summary", () => {
    expect(takeLeadLine("Dạ em ghi nhận rồi ạ.\nLEAD: 6 ghế pedicure, tiệm mới ở Texas")).toEqual({ text: "Dạ em ghi nhận rồi ạ.", summary: "6 ghế pedicure, tiệm mới ở Texas" });
    expect(takeLeadLine("No lead here")).toEqual({ text: "No lead here", summary: "" });
  });
});

describe("formatPhone", () => {
  it("formats US numbers and leaves others alone", () => {
    expect(formatPhone("3465550142")).toBe("(346) 555-0142");
    expect(formatPhone("+12675550170")).toBe("(267) 555-0170");
    expect(formatPhone("0900000000")).toBe("0900000000");
  });
});
