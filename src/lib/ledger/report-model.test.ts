import { describe, expect, it } from "vitest";
import {
  buildBalanceSheet,
  buildCashFlow,
  buildIncomeStatement,
  changeOf,
  percentOf,
  type BalanceRow,
  type CashFlowRow,
  type IncomeRow,
} from "./report-model";
import type { Account } from "./types";

const account = (overrides: Partial<Account> & Pick<Account, "id" | "name" | "type">): Account => ({
  ledger_id: "L",
  parent_id: null,
  subtype: null,
  icon: null,
  color: null,
  is_system: false,
  is_archived: false,
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const incomeRow = (account_id: string, type: "revenue" | "expense", amount: number, parent_id: string | null = null): IncomeRow => ({
  account_id,
  parent_id,
  name: account_id,
  type,
  icon: null,
  color: null,
  sort_order: 0,
  amount,
});

describe("損益表", () => {
  const accounts: Account[] = [
    account({ id: "salary", name: "薪資", type: "revenue", sort_order: 1 }),
    account({ id: "bonus", name: "獎金", type: "revenue", sort_order: 2 }),
    account({ id: "food", name: "飲食", type: "expense", sort_order: 1 }),
    account({ id: "lunch", name: "午餐", type: "expense", parent_id: "food", sort_order: 1 }),
    account({ id: "coffee", name: "咖啡", type: "expense", parent_id: "food", sort_order: 2 }),
    account({ id: "transport", name: "交通", type: "expense", sort_order: 2 }),
    account({ id: "old", name: "舊類別", type: "expense", sort_order: 3, is_archived: true }),
  ];

  it("父類別彙總自身與子類別，只列有金額的類別", () => {
    const current = [incomeRow("salary", "revenue", 50000), incomeRow("lunch", "expense", 1200, "food"), incomeRow("food", "expense", 300)];
    const previous = [incomeRow("salary", "revenue", 48000), incomeRow("coffee", "expense", 450, "food"), incomeRow("transport", "expense", 900)];
    const statement = buildIncomeStatement(current, previous, accounts);

    expect(statement.revenue.lines.map((l) => l.id)).toEqual(["salary"]);
    expect(statement.revenue.current).toBe(50000);
    expect(statement.revenue.previous).toBe(48000);

    const food = statement.expense.lines.find((l) => l.id === "food")!;
    expect(food.current).toBe(1500); // 300 自身 + 1200 午餐
    expect(food.previous).toBe(450);
    expect(food.children.map((c) => c.id)).toEqual(["lunch", "coffee"]);

    // 交通只有上期有金額，仍要列；舊類別兩期都 0 不列
    expect(statement.expense.lines.map((l) => l.id)).toEqual(["food", "transport"]);
    expect(statement.expense.current).toBe(1500);
    expect(statement.expense.previous).toBe(1350);
    expect(statement.netCurrent).toBe(48500);
    expect(statement.netPrevious).toBe(46650);
  });

  it("加總不留浮點誤差", () => {
    const current = [incomeRow("lunch", "expense", 0.1, "food"), incomeRow("coffee", "expense", 0.2, "food")];
    const statement = buildIncomeStatement(current, [], accounts);
    expect(statement.expense.current).toBe(0.3);
  });

  it("佔比與變化", () => {
    expect(percentOf(25, 200)).toBe(12.5);
    expect(percentOf(25, 0)).toBeNull();
    expect(changeOf(120, 100)).toEqual({ amount: 20, percent: 20 });
    expect(changeOf(80, 100)).toEqual({ amount: -20, percent: -20 });
    expect(changeOf(80, 0)).toEqual({ amount: 80, percent: null });
  });
});

describe("資產負債表", () => {
  const row = (overrides: Partial<BalanceRow> & Pick<BalanceRow, "name" | "type" | "balance">): BalanceRow => ({
    account_id: overrides.name,
    subtype: null,
    icon: null,
    color: null,
    is_system: false,
    is_archived: false,
    sort_order: 0,
    ...overrides,
  });

  it("三區合計、期初對照、檢核列與淨值", () => {
    const end = [
      row({ name: "銀行", type: "asset", balance: 126000, sort_order: 1 }),
      row({ name: "現金", type: "asset", balance: 500, sort_order: 2 }),
      row({ name: "信用卡", type: "liability", balance: 4000 }),
      row({ name: "期初餘額", type: "equity", balance: 98000, is_system: true }),
      row({ account_id: null, name: "累積損益", type: "equity", subtype: "retained_earnings", balance: 24500, is_system: true, sort_order: 9999 }),
    ];
    const start = [
      row({ name: "銀行", type: "asset", balance: 100000, sort_order: 1 }),
      row({ name: "現金", type: "asset", balance: 3000, sort_order: 2 }),
      row({ name: "信用卡", type: "liability", balance: 5000 }),
      row({ name: "期初餘額", type: "equity", balance: 98000, is_system: true }),
      row({ account_id: null, name: "累積損益", type: "equity", subtype: "retained_earnings", balance: 0, is_system: true, sort_order: 9999 }),
    ];
    const sheet = buildBalanceSheet(end, start);
    expect(sheet.assets.end).toBe(126500);
    expect(sheet.assets.start).toBe(103000);
    expect(sheet.liabilities.end).toBe(4000);
    expect(sheet.equity.end).toBe(122500);
    expect(sheet.equity.lines.map((l) => l.key)).toEqual(["期初餘額", "retained"]);
    expect(sheet.check).toEqual({ end: 0, start: 0 });
    expect(sheet.netWorth).toEqual({ end: 122500, start: 98000 });
    expect(sheet.assets.lines[0].change).toBe(26000);
  });

  it("餘額為 0 的封存帳戶不列，有餘額的照列", () => {
    const end = [
      row({ name: "舊錢包", type: "asset", balance: 0, is_archived: true, sort_order: 1 }),
      row({ name: "舊銀行", type: "asset", balance: 10, is_archived: true, sort_order: 2 }),
      row({ name: "空帳戶", type: "asset", balance: 0, sort_order: 3 }),
    ];
    const sheet = buildBalanceSheet(end, end);
    expect(sheet.assets.lines.map((l) => l.name)).toEqual(["舊銀行", "空帳戶"]);
  });
});

describe("現金流量表", () => {
  const flow = (activity: CashFlowRow["activity"], name: string, inflow: number, outflow: number): CashFlowRow => ({
    section: "flow",
    activity,
    account_id: name,
    name,
    icon: null,
    color: null,
    inflow,
    outflow,
  });

  it("三活動小計、淨流量與期初＋淨流量＝期末的檢核", () => {
    const rows: CashFlowRow[] = [
      { section: "opening", activity: null, account_id: null, name: "期初現金", icon: null, color: null, inflow: 0, outflow: 0 },
      { section: "closing", activity: null, account_id: null, name: "期末現金", icon: null, color: null, inflow: 126500, outflow: 0 },
      flow("operating", "薪資", 50000, 0),
      flow("operating", "飲食", 0, 1500),
      flow("investing", "投資", 0, 20000),
      flow("financing", "期初餘額", 103000, 0),
      flow("financing", "信用卡", 0, 5000),
    ];
    const statement = buildCashFlow(rows);
    expect(statement.opening).toBe(0);
    expect(statement.closing).toBe(126500);
    const [operating, investing, financing] = statement.activities;
    expect(operating.net).toBe(48500);
    expect(operating.lines.map((l) => l.name)).toEqual(["薪資", "飲食"]); // 金額大的排前面
    expect(investing.net).toBe(-20000);
    expect(financing.net).toBe(98000);
    expect(statement.net).toBe(126500);
    expect(statement.check).toBe(0);
  });

  it("沒有資料時三活動都空、檢核仍成立", () => {
    const statement = buildCashFlow([]);
    expect(statement.activities.every((a) => a.lines.length === 0)).toBe(true);
    expect(statement.check).toBe(0);
  });
});
