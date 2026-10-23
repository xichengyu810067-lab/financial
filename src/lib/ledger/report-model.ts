import type { Account } from "./types";

/**
 * 把資料庫報表函式回傳的列整理成畫面要的結構（純函式，Vitest 可測）。
 * 金額都已是 number；加總後以 round2 去掉浮點誤差。
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const isZero = (n: number) => Math.abs(n) < 0.005;
const sum = (values: number[]) => round2(values.reduce((s, v) => s + v, 0));

export interface IncomeRow {
  account_id: string;
  parent_id: string | null;
  name: string;
  type: "revenue" | "expense";
  icon: string | null;
  color: string | null;
  sort_order: number;
  amount: number;
}

export interface BalanceRow {
  /** null = 系統合成的「累積損益」列 */
  account_id: string | null;
  name: string;
  type: "asset" | "liability" | "equity";
  subtype: string | null;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  is_archived: boolean;
  sort_order: number;
  balance: number;
}

export type Activity = "operating" | "investing" | "financing";

export interface CashFlowRow {
  section: "flow" | "opening" | "closing";
  activity: Activity | null;
  account_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  inflow: number;
  outflow: number;
}

// ---------------------------------------------------------------------------
// 共用：佔比與變化
// ---------------------------------------------------------------------------

/** part 佔 whole 的百分比；whole 為 0 時回 null（畫面顯示「—」） */
export function percentOf(part: number, whole: number): number | null {
  return isZero(whole) ? null : (part / whole) * 100;
}

/** 本期相對上期的變化：金額永遠有，百分比在上期為 0 時為 null */
export function changeOf(current: number, previous: number): { amount: number; percent: number | null } {
  const amount = round2(current - previous);
  return { amount, percent: isZero(previous) ? null : (amount / Math.abs(previous)) * 100 };
}

// ---------------------------------------------------------------------------
// 損益表
// ---------------------------------------------------------------------------

export interface IncomeLine {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  /** 父類別 = 自身 + 子類別 */
  current: number;
  previous: number;
  children: IncomeLine[];
}

export interface IncomeSection {
  lines: IncomeLine[];
  current: number;
  previous: number;
}

export interface IncomeStatement {
  revenue: IncomeSection;
  expense: IncomeSection;
  netCurrent: number;
  netPrevious: number;
}

/**
 * 以科目表為骨架（含封存類別，歷史交易可能用到），填入本期與上期金額。
 * 只保留本期或上期任一不為 0 的類別；父類別只要有子類別有金額就會出現。
 */
export function buildIncomeStatement(current: IncomeRow[], previous: IncomeRow[], accounts: Account[]): IncomeStatement {
  const cur = new Map(current.map((r) => [r.account_id, r.amount]));
  const prev = new Map(previous.map((r) => [r.account_id, r.amount]));
  const categories = accounts
    .filter((a) => a.type === "revenue" || a.type === "expense")
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  const toLine = (a: Account, children: IncomeLine[]): IncomeLine => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    color: a.color,
    current: sum([cur.get(a.id) ?? 0, ...children.map((c) => c.current)]),
    previous: sum([prev.get(a.id) ?? 0, ...children.map((c) => c.previous)]),
    children,
  });
  const hasAmount = (line: IncomeLine) => !isZero(line.current) || !isZero(line.previous);

  const build = (type: "revenue" | "expense"): IncomeSection => {
    const lines = categories
      .filter((a) => a.type === type && !a.parent_id)
      .map((parent) => {
        const children = categories
          .filter((c) => c.parent_id === parent.id)
          .map((c) => toLine(c, []))
          .filter(hasAmount);
        return toLine(parent, children);
      })
      .filter(hasAmount);
    return { lines, current: sum(lines.map((l) => l.current)), previous: sum(lines.map((l) => l.previous)) };
  };

  const revenue = build("revenue");
  const expense = build("expense");
  return {
    revenue,
    expense,
    netCurrent: round2(revenue.current - expense.current),
    netPrevious: round2(revenue.previous - expense.previous),
  };
}

// ---------------------------------------------------------------------------
// 資產負債表
// ---------------------------------------------------------------------------

export interface BalanceLine {
  /** account_id，累積損益列為 "retained" */
  key: string;
  id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  subtype: string | null;
  isSystem: boolean;
  isArchived: boolean;
  end: number;
  start: number;
  change: number;
}

export interface BalanceSection {
  lines: BalanceLine[];
  end: number;
  start: number;
}

export interface BalanceSheet {
  assets: BalanceSection;
  liabilities: BalanceSection;
  equity: BalanceSection;
  /** 資產 − 負債 − 權益，應為 0 */
  check: { end: number; start: number };
  netWorth: { end: number; start: number };
}

export const RETAINED_KEY = "retained";
const balanceKey = (row: BalanceRow) => row.account_id ?? RETAINED_KEY;

/** endRows 是期末（截至 to）、startRows 是期初（截至 from 的前一天） */
export function buildBalanceSheet(endRows: BalanceRow[], startRows: BalanceRow[]): BalanceSheet {
  const start = new Map(startRows.map((r) => [balanceKey(r), r.balance]));

  const build = (type: BalanceRow["type"]): BalanceSection => {
    const lines = endRows
      .filter((r) => r.type === type)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh-Hant"))
      .map((r): BalanceLine => {
        const startBalance = start.get(balanceKey(r)) ?? 0;
        return {
          key: balanceKey(r),
          id: r.account_id,
          name: r.name,
          icon: r.icon,
          color: r.color,
          subtype: r.subtype,
          isSystem: r.is_system,
          isArchived: r.is_archived,
          end: r.balance,
          start: startBalance,
          change: round2(r.balance - startBalance),
        };
      })
      // 餘額為 0 的封存帳戶不列；有餘額的封存帳戶照列並標示
      .filter((l) => !(l.isArchived && isZero(l.end) && isZero(l.start)));
    return { lines, end: sum(lines.map((l) => l.end)), start: sum(lines.map((l) => l.start)) };
  };

  const assets = build("asset");
  const liabilities = build("liability");
  const equity = build("equity");
  return {
    assets,
    liabilities,
    equity,
    check: {
      end: round2(assets.end - liabilities.end - equity.end),
      start: round2(assets.start - liabilities.start - equity.start),
    },
    netWorth: { end: round2(assets.end - liabilities.end), start: round2(assets.start - liabilities.start) },
  };
}

// ---------------------------------------------------------------------------
// 現金流量表
// ---------------------------------------------------------------------------

export const ACTIVITIES: { key: Activity; label: string; description: string }[] = [
  { key: "operating", label: "營業活動", description: "收入進帳與日常支出" },
  { key: "investing", label: "投資活動", description: "投資等非現金資產的買進賣出" },
  { key: "financing", label: "融資活動", description: "信用卡還款、貸款、期初餘額" },
];

export interface CashFlowLine {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  inflow: number;
  outflow: number;
  net: number;
}

export interface CashFlowActivity {
  key: Activity;
  label: string;
  description: string;
  lines: CashFlowLine[];
  inflow: number;
  outflow: number;
  net: number;
}

export interface CashFlowStatement {
  opening: number;
  closing: number;
  activities: CashFlowActivity[];
  /** 三活動淨額合計 */
  net: number;
  /** 期初 + 淨流量 − 期末，應為 0 */
  check: number;
}

export function buildCashFlow(rows: CashFlowRow[]): CashFlowStatement {
  const opening = rows.find((r) => r.section === "opening")?.inflow ?? 0;
  const closing = rows.find((r) => r.section === "closing")?.inflow ?? 0;

  const activities = ACTIVITIES.map((meta): CashFlowActivity => {
    const lines = rows
      .filter((r) => r.section === "flow" && r.activity === meta.key && r.account_id)
      .map((r): CashFlowLine => ({
        id: r.account_id!,
        name: r.name,
        icon: r.icon,
        color: r.color,
        inflow: r.inflow,
        outflow: r.outflow,
        net: round2(r.inflow - r.outflow),
      }))
      .filter((l) => !isZero(l.inflow) || !isZero(l.outflow))
      .sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow) || a.name.localeCompare(b.name, "zh-Hant"));
    const inflow = sum(lines.map((l) => l.inflow));
    const outflow = sum(lines.map((l) => l.outflow));
    return { ...meta, lines, inflow, outflow, net: round2(inflow - outflow) };
  });

  const net = sum(activities.map((a) => a.net));
  return { opening, closing, activities, net, check: round2(opening + net - closing) };
}
