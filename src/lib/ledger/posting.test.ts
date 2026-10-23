import { describe, expect, it } from "vitest";
import {
  buildLines,
  describeLines,
  isBalanced,
  normalBalance,
  PostingError,
  type AccountRef,
} from "./posting";

const cash: AccountRef = { id: "cash", type: "asset", name: "現金" };
const bank: AccountRef = { id: "bank", type: "asset", name: "銀行存款" };
const card: AccountRef = { id: "card", type: "liability", name: "信用卡" };
const opening: AccountRef = { id: "opening", type: "equity", name: "期初餘額" };
const salary: AccountRef = { id: "salary", type: "revenue", name: "薪資" };
const food: AccountRef = { id: "food", type: "expense", name: "飲食" };

const nameOf = (id: string) =>
  ({ cash: "現金", bank: "銀行存款", card: "信用卡", opening: "期初餘額", salary: "薪資", food: "飲食" })[id] ?? id;

describe("buildLines", () => {
  it("支出：借 費用 / 貸 來源帳戶", () => {
    const lines = buildLines({ kind: "expense", amount: 150, fromAccount: cash, category: food });
    expect(lines).toEqual([
      { accountId: "food", debit: 150, credit: 0 },
      { accountId: "cash", debit: 0, credit: 150 },
    ]);
    expect(isBalanced(lines)).toBe(true);
    expect(describeLines(lines, nameOf)).toBe("借 飲食 150 / 貸 現金 150");
  });

  it("信用卡消費：貸方是負債帳戶，負債增加", () => {
    const lines = buildLines({ kind: "expense", amount: 1200, fromAccount: card, category: food });
    expect(lines[1]).toEqual({ accountId: "card", debit: 0, credit: 1200 });
    expect(normalBalance("liability", 0, 1200)).toBe(1200);
  });

  it("收入：借 去向帳戶 / 貸 收入", () => {
    const lines = buildLines({ kind: "income", amount: 50000, toAccount: bank, category: salary });
    expect(lines).toEqual([
      { accountId: "bank", debit: 50000, credit: 0 },
      { accountId: "salary", debit: 0, credit: 50000 },
    ]);
    expect(isBalanced(lines)).toBe(true);
  });

  it("轉帳還卡費：借 信用卡（負債減少）/ 貸 銀行", () => {
    const lines = buildLines({ kind: "transfer", amount: 10000, fromAccount: bank, toAccount: card });
    expect(lines).toEqual([
      { accountId: "card", debit: 10000, credit: 0 },
      { accountId: "bank", debit: 0, credit: 10000 },
    ]);
    expect(normalBalance("liability", 10000, 0)).toBe(-10000);
  });

  it("期初餘額：資產借方、負債貸方", () => {
    const asset = buildLines({ kind: "opening", amount: 100000, toAccount: bank, openingEquity: opening });
    expect(asset).toEqual([
      { accountId: "bank", debit: 100000, credit: 0 },
      { accountId: "opening", debit: 0, credit: 100000 },
    ]);
    const liability = buildLines({ kind: "opening", amount: 5000, toAccount: card, openingEquity: opening });
    expect(liability).toEqual([
      { accountId: "opening", debit: 5000, credit: 0 },
      { accountId: "card", debit: 0, credit: 5000 },
    ]);
  });

  it("小數金額不會因浮點誤差失衡", () => {
    const lines = buildLines({ kind: "expense", amount: 0.1 + 0.2, fromAccount: cash, category: food });
    expect(lines[0].debit).toBe(0.3);
    expect(isBalanced(lines)).toBe(true);
  });

  it("拒絕無效輸入", () => {
    expect(() => buildLines({ kind: "expense", amount: 0, fromAccount: cash, category: food })).toThrow(PostingError);
    expect(() => buildLines({ kind: "expense", amount: 1.234, fromAccount: cash, category: food })).toThrow(/兩位小數/);
    expect(() => buildLines({ kind: "expense", amount: 100, fromAccount: cash, category: salary })).toThrow(/費用科目/);
    expect(() => buildLines({ kind: "income", amount: 100, toAccount: bank, category: food })).toThrow(/收入科目/);
    expect(() => buildLines({ kind: "transfer", amount: 100, fromAccount: cash, toAccount: cash })).toThrow(/不能相同/);
    expect(() => buildLines({ kind: "transfer", amount: 100, fromAccount: cash, toAccount: food })).toThrow(/資產或負債/);
    expect(() => buildLines({ kind: "opening", amount: 100, toAccount: bank, openingEquity: salary })).toThrow(/權益/);
  });
});

describe("isBalanced", () => {
  it("少於兩行或借貸不等都不平衡", () => {
    expect(isBalanced([])).toBe(false);
    expect(isBalanced([{ accountId: "cash", debit: 10, credit: 0 }])).toBe(false);
    expect(
      isBalanced([
        { accountId: "food", debit: 10, credit: 0 },
        { accountId: "cash", debit: 0, credit: 9 },
      ]),
    ).toBe(false);
  });
});
