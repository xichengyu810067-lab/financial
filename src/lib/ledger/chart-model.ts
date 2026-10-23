import { aggregateStats, effectiveBudget, OVER_RATIO, type CategoryStat } from "./alerts";
import { getColor } from "./colors";
import type { DailySummaryRow } from "./days";
import { addDays, daysBetween, shortMonthLabel } from "./period";
import { round2, type IncomeLine } from "./report-model";

/**
 * 圖表資料整形（純函式，Vitest）：補齊沒有交易的日子／月份、環圈切片、基準線進度。
 */

export interface DailyPoint {
  day: string;
  /** "10/23" */
  label: string;
  income: number;
  expense: number;
  /** 畫在基線下方用的負值 */
  expenseDown: number;
  entryCount: number;
}

/** 每一天一個點，沒交易的日子補 0 */
export function dailySeries(rows: DailySummaryRow[], from: string, to: string): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const length = daysBetween(from, to);
  return Array.from({ length }, (_, i) => {
    const day = addDays(from, i);
    const row = byDay.get(day);
    const income = row?.income ?? 0;
    const expense = row?.expense ?? 0;
    return {
      day,
      label: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
      income,
      expense,
      expenseDown: expense === 0 ? 0 : -expense,
      entryCount: row?.entryCount ?? 0,
    };
  });
}

export interface DonutSlice {
  /** null = 「其他」合併切片 */
  id: string | null;
  name: string;
  icon: string | null;
  value: number;
  percent: number;
  /** 圖表用的 hex */
  color: string;
  /** 合併進「其他」的類別 id */
  memberIds: string[];
}

export const MAX_DONUT_SLICES = 6;
const OTHER_COLOR = "#8A7B70";

/** 支出類別占比：金額大的在前，超過 6 片時把尾巴合併成「其他」 */
export function donutSlices(lines: IncomeLine[]): DonutSlice[] {
  const sorted = lines.filter((l) => l.current > 0).sort((a, b) => b.current - a.current);
  const total = round2(sorted.reduce((s, l) => s + l.current, 0));
  if (total === 0) return [];
  const head = sorted.length > MAX_DONUT_SLICES ? sorted.slice(0, MAX_DONUT_SLICES - 1) : sorted;
  const tail = sorted.slice(head.length);
  const slices: DonutSlice[] = head.map((l) => ({
    id: l.id,
    name: l.name,
    icon: l.icon,
    value: l.current,
    percent: (l.current / total) * 100,
    color: getColor(l.color).hex,
    memberIds: [l.id, ...l.children.map((c) => c.id)],
  }));
  if (tail.length > 0) {
    const value = round2(tail.reduce((s, l) => s + l.current, 0));
    slices.push({
      id: null,
      name: `其他 ${tail.length} 類`,
      icon: null,
      value,
      percent: (value / total) * 100,
      color: OTHER_COLOR,
      memberIds: tail.flatMap((l) => [l.id, ...l.children.map((c) => c.id)]),
    });
  }
  return slices;
}

export interface MonthPoint {
  month: string;
  /** "3 月" */
  label: string;
  income: number;
  expense: number;
}

/** 每個月一個點，沒資料的月份補 0 */
export function monthSeries(rows: { month: string; income: number; expense: number }[], months: string[]): MonthPoint[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return months.map((month) => ({
    month,
    label: shortMonthLabel(month),
    income: byMonth.get(month)?.income ?? 0,
    expense: byMonth.get(month)?.expense ?? 0,
  }));
}

export interface NetWorthPoint {
  month: string;
  label: string;
  netWorth: number;
}

/** 淨值走勢只畫到 upTo（YYYY-MM）這個月 */
export function netWorthSeries(rows: { month: string; netWorth: number }[], upTo: string): NetWorthPoint[] {
  return rows
    .filter((r) => r.month <= upTo)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ month: r.month, label: shortMonthLabel(r.month), netWorth: r.netWorth }));
}

/** 1234 → "1.2K"、1500000 → "1.5M"、-800 → "-800" */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${trimZero((abs / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${sign}${trimZero((abs / 1_000).toFixed(1))}K`;
  return `${sign}${Math.round(abs)}`;
}

const trimZero = (s: string) => s.replace(/\.0$/, "");

export type BaselineLevel = "over" | "habit" | "ok" | "none";

export interface BaselineRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  memberIds: string[];
  spent: number;
  /** 這個月實際用的尺：當月覆寫 → 類別基準線 → 三個月平均 */
  baseline: number | null;
  /** baseline 來自基準線或覆寫（不是平均） */
  usingBudget: boolean;
  /** 類別基準線（可能被覆寫） */
  categoryBudget: number | null;
  /** 當月覆寫 */
  monthBudget: number | null;
  /** spent ÷ baseline，可超過 1；沒基準線為 null */
  ratio: number | null;
  level: BaselineLevel;
}

/** 每個頂層費用類別離基準線還有多遠；沒填基準線用前三個月平均。超標的排前面，再依金額。 */
export function baselineRows(stats: CategoryStat[]): BaselineRow[] {
  const { parents, children } = aggregateStats(stats);
  return parents
    .filter((p) => !p.is_archived || p.month_to_date > 0)
    .map((p): BaselineRow => {
      const budget = effectiveBudget(p);
      const usingBudget = budget !== null;
      const baseline = budget ?? (p.prev3_months > 0 && p.prev3_avg > 0 ? p.prev3_avg : null);
      const ratio = baseline ? p.month_to_date / baseline : null;
      const level: BaselineLevel =
        ratio === null ? "none" : ratio > 1 ? "over" : usingBudget && p.prev3_months > 0 && p.prev3_avg > budget! * OVER_RATIO ? "habit" : "ok";
      return {
        id: p.account_id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        memberIds: [p.account_id, ...children.filter((c) => c.parent_id === p.account_id).map((c) => c.account_id)],
        spent: p.month_to_date,
        baseline,
        usingBudget,
        categoryBudget: p.monthly_budget,
        monthBudget: p.month_budget,
        ratio,
        level,
      };
    })
    .filter((r) => r.baseline !== null || r.spent > 0)
    .sort((a, b) => {
      const rank = (l: BaselineLevel) => (l === "over" ? 0 : l === "habit" ? 1 : 2);
      return rank(a.level) - rank(b.level) || b.spent - a.spent;
    });
}
