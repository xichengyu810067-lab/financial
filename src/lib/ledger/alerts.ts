import type { Entry } from "./entries";
import { formatTWD } from "./format";
import { round2 } from "./report-model";

/**
 * 「花過頭」的判斷（純函式，Vitest）。資料來自 category_spending_stats：
 *   紅色（本月速度）：本月至今 ÷ 已過天數 × 當月天數，超過基準線 30% 就警示；
 *                   沒填基準線的類別用前三個月平均當基準線。本月不足 3 天或不足 2 筆不預估。
 *   橙色（習慣性超支）：前三個月平均月支出超過基準線 30%（只對有填基準線的類別）。
 *   單筆大額：一筆超過該類別前 90 天平均單筆 3 倍，且歷史至少 5 筆。
 * 父類別以「自身 + 子類別」評估；子類別自己填了基準線就另外評估。
 */

export interface CategoryStat {
  account_id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  is_archived: boolean;
  sort_order: number;
  /** 類別基準線 */
  monthly_budget: number | null;
  /** 當月覆寫（budgets 表）；優先於基準線 */
  month_budget: number | null;
  month_to_date: number;
  month_count: number;
  prev3_avg: number;
  prev3_months: number;
  recent_avg_entry: number;
  recent_count: number;
}

export type AlertLevel = "red" | "orange" | "large";

export interface SpendingAlert {
  level: AlertLevel;
  categoryId: string;
  categoryName: string;
  icon: string | null;
  color: string | null;
  /** 一句話說發生什麼事 */
  title: string;
  /** 一句建議 */
  advice: string;
  /** 本月至今 ÷ 基準線（可超過 1）；沒有基準線時為 null */
  ratio: number | null;
  spent: number;
  baseline: number | null;
}

export const OVER_RATIO = 1.3;
export const MIN_DAYS_FOR_PACE = 3;
export const MIN_ENTRIES_FOR_PACE = 2;
export const LARGE_ENTRY_MULTIPLIER = 3;
export const MIN_HISTORY_FOR_LARGE = 5;

/** 這個月實際用的基準線：當月覆寫 → 類別基準線；都沒有就 null */
export function effectiveBudget(stat: Pick<CategoryStat, "monthly_budget" | "month_budget">): number | null {
  const budget = stat.month_budget ?? stat.monthly_budget;
  return budget !== null && budget > 0 ? budget : null;
}

export function monthContext(asOf: string): { daysInMonth: number; dayOfMonth: number } {
  const [y, m, d] = asOf.split("-").map(Number);
  return { daysInMonth: new Date(y, m, 0).getDate(), dayOfMonth: d };
}

const sum = (values: number[]) => round2(values.reduce((s, v) => s + v, 0));
const percentOver = (value: number, base: number) => Math.round((value / base - 1) * 100);

/** 父類別 = 自身 + 子類別；子類別維持原列。回傳的順序：父類別（含彙總）在前。 */
export function aggregateStats(stats: CategoryStat[]): { parents: CategoryStat[]; children: CategoryStat[] } {
  const children = stats.filter((s) => s.parent_id !== null);
  const parents = stats
    .filter((s) => s.parent_id === null)
    .map((parent) => {
      const kids = children.filter((c) => c.parent_id === parent.account_id);
      if (kids.length === 0) return parent;
      const all = [parent, ...kids];
      const recentCount = all.reduce((s, x) => s + x.recent_count, 0);
      return {
        ...parent,
        month_to_date: sum(all.map((x) => x.month_to_date)),
        month_count: all.reduce((s, x) => s + x.month_count, 0),
        prev3_avg: sum(all.map((x) => x.prev3_avg)),
        prev3_months: Math.max(...all.map((x) => x.prev3_months)),
        recent_avg_entry: recentCount > 0 ? round2(all.reduce((s, x) => s + x.recent_avg_entry * x.recent_count, 0) / recentCount) : 0,
        recent_count: recentCount,
      };
    });
  return { parents, children };
}

function paceAlert(stat: CategoryStat, asOf: string): SpendingAlert | null {
  const { daysInMonth, dayOfMonth } = monthContext(asOf);
  const budget = effectiveBudget(stat);
  const usingBudget = budget !== null;
  const baseline = budget ?? (stat.prev3_months > 0 && stat.prev3_avg > 0 ? stat.prev3_avg : null);
  if (baseline === null) return null;
  if (dayOfMonth < MIN_DAYS_FOR_PACE || stat.month_count < MIN_ENTRIES_FOR_PACE) return null;
  const projected = Math.round((stat.month_to_date / dayOfMonth) * daysInMonth);
  if (projected <= baseline * OVER_RATIO) return null;

  const remaining = daysInMonth - dayOfMonth;
  const allowance = remaining > 0 ? Math.max(0, baseline - stat.month_to_date) / remaining : 0;
  const baseLabel = usingBudget ? "基準線" : "過去三個月平均";
  const advice =
    remaining === 0
      ? `本月已結束，下個月留意這一項。`
      : allowance > 0
        ? `剩 ${remaining} 天，建議每天 ${formatTWD(Math.floor(allowance))} 內。`
        : `本月已超過${baseLabel}，剩 ${remaining} 天建議暫停非必要支出。`;

  return {
    level: "red",
    categoryId: stat.account_id,
    categoryName: stat.name,
    icon: stat.icon,
    color: stat.color,
    title: `${stat.name}照目前速度整月會花 ${formatTWD(projected)}，超過${baseLabel} ${formatTWD(baseline)}（+${percentOver(projected, baseline)}%）`,
    advice,
    ratio: stat.month_to_date / baseline,
    spent: stat.month_to_date,
    baseline,
  };
}

function habitAlert(stat: CategoryStat): SpendingAlert | null {
  const budget = effectiveBudget(stat);
  if (budget === null || stat.prev3_months === 0) return null;
  if (stat.prev3_avg <= budget * OVER_RATIO) return null;
  const within = stat.month_to_date <= budget;
  return {
    level: "orange",
    categoryId: stat.account_id,
    categoryName: stat.name,
    icon: stat.icon,
    color: stat.color,
    title: `${stat.name}過去三個月平均 ${formatTWD(stat.prev3_avg)}，比基準線 ${formatTWD(budget)} 高 ${percentOver(stat.prev3_avg, budget)}%`,
    advice: within
      ? `本月至今 ${formatTWD(stat.month_to_date)}，還在線內，照這樣就好。`
      : `本月至今 ${formatTWD(stat.month_to_date)}，已經超過基準線。`,
    ratio: stat.month_to_date / budget,
    spent: stat.month_to_date,
    baseline: budget,
  };
}

function largeEntryAlerts(stats: CategoryStat[], entries: Entry[]): SpendingAlert[] {
  const byId = new Map(stats.map((s) => [s.account_id, s]));
  const alerts: SpendingAlert[] = [];
  for (const entry of entries) {
    if (entry.kind !== "expense" || !entry.category_id) continue;
    const stat = byId.get(entry.category_id);
    if (!stat || stat.recent_count < MIN_HISTORY_FOR_LARGE || stat.recent_avg_entry <= 0) continue;
    const amount = Number(entry.amount);
    if (amount <= stat.recent_avg_entry * LARGE_ENTRY_MULTIPLIER) continue;
    const times = amount / stat.recent_avg_entry;
    alerts.push({
      level: "large",
      categoryId: stat.account_id,
      categoryName: stat.name,
      icon: stat.icon,
      color: stat.color,
      title: `這筆${stat.name} ${formatTWD(amount)} 是平常的 ${times.toFixed(1)} 倍`,
      advice: `平常一筆約 ${formatTWD(Math.round(stat.recent_avg_entry))}；如果是計畫內的大額就不用在意。`,
      ratio: null,
      spent: amount,
      baseline: null,
    });
  }
  return alerts;
}

/** 某一天的警示：紅色在前，再來單筆大額，最後橙色；同一個類別紅色優先於橙色 */
export function evaluateSpendingAlerts(stats: CategoryStat[], dayEntries: Entry[], asOf: string): SpendingAlert[] {
  const { parents, children } = aggregateStats(stats);
  const candidates = [...parents, ...children.filter((c) => effectiveBudget(c) !== null)];

  const red: SpendingAlert[] = [];
  const orange: SpendingAlert[] = [];
  for (const stat of candidates) {
    const pace = paceAlert(stat, asOf);
    if (pace) {
      red.push(pace);
      continue;
    }
    const habit = habitAlert(stat);
    if (habit) orange.push(habit);
  }
  const byOvershoot = (a: SpendingAlert, b: SpendingAlert) => (b.ratio ?? 0) - (a.ratio ?? 0);
  return [...red.sort(byOvershoot), ...largeEntryAlerts(stats, dayEntries), ...orange.sort(byOvershoot)];
}
