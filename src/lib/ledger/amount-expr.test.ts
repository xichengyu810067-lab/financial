import { describe, expect, it } from "vitest";
import { evaluateAmount } from "./amount-expr";

function value(input: string): number {
  const r = evaluateAmount(input);
  if (!r.ok) throw new Error(`expected ok for "${input}", got ${r.error}`);
  return r.value;
}

function error(input: string): string {
  const r = evaluateAmount(input);
  if (r.ok) throw new Error(`expected error for "${input}", got ${r.value}`);
  return r.error;
}

describe("evaluateAmount", () => {
  it("純數字", () => {
    expect(value("150")).toBe(150);
    expect(value("1,250")).toBe(1250);
    expect(value(" 99.5 ")).toBe(99.5);
    expect(value("０１２")).toBe(12);
    expect(evaluateAmount("150")).toMatchObject({ isExpression: false });
  });

  it("四則運算與括號", () => {
    expect(value("120+35")).toBe(155);
    expect(value("300*2")).toBe(600);
    expect(value("(80+20)/2")).toBe(50);
    expect(value("10+2*3")).toBe(16);
    expect(value("100-30-20")).toBe(50);
    expect(value("2×3÷4")).toBe(1.5);
    expect(value("-5+10")).toBe(5);
    expect(evaluateAmount("120+35")).toMatchObject({ isExpression: true });
  });

  it("小數四捨五入到兩位", () => {
    expect(value("100/3")).toBe(33.33);
    expect(value("0.1+0.2")).toBe(0.3);
    expect(value("2.005*100")).toBe(200.5);
  });

  it("拒絕無效輸入", () => {
    expect(error("")).toBe("請輸入金額");
    expect(error("abc")).toMatch(/不支援的字元/);
    expect(error("1.2.3")).toMatch(/不是有效的數字/);
    expect(error("10/0")).toBe("不能除以 0");
    expect(error("0")).toBe("金額必須大於 0");
    expect(error("5-10")).toBe("金額必須大於 0");
    expect(error("(80+20")).toBe("括號沒有關閉");
    expect(error("80+")).toBe("算式不完整");
    expect(error("2(3)")).toBe("算式格式不正確");
    expect(error("1e15")).toMatch(/不支援的字元/);
    expect(error("9999999999999")).toBe("金額太大");
  });
});
