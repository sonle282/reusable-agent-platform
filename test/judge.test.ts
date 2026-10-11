import { describe, expect, it } from "vitest";
import { readVerdict } from "../src/shared/judge";

describe("readVerdict", () => {
  it("reads clean, fenced and slightly broken verdicts", () => {
    expect(readVerdict('{"pass": true, "reason": "Đúng ý"}')).toEqual({ pass: true, reason: "Đúng ý" });
    expect(readVerdict('```json\n{"pass": false, "reason": "Thiếu số 215"}\n```')).toEqual({ pass: false, reason: "Thiếu số 215" });
    expect(readVerdict('{"pass": true, "reason": "Nói "giá sỉ" là đúng"}')?.pass).toBe(true);
    expect(readVerdict("I think it is fine.")).toBeNull();
  });
});
