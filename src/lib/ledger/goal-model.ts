import { formatTWD } from "./format";
import { monthLabel, shiftMonth } from "./month";
import { round2 } from "./report-model";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * 儲蓄目標的純函式（Vitest）：進度、預測達標月份、首頁要顯示哪一個、這筆記帳會不會讓目標達標。
 *   綁帳戶的目標：已存 = 帳戶餘額；手動目標：已存 = 存入合計（由 goal_progress 算好）
 *   每月速度 = 最近 90 天的增加 ÷ 3；預估月份 = 本月 + ceil(剩餘 ÷ 每月速度)
 */

export type Goal = Tables<"goals">;

export interface GoalProgressRow {
  goalId: string;
  saved: number;
  saved90d: number;
}

export type GoalForecast =
  | { kind: "achieved" }
  /** 最近三個月沒有增加；有目標日時附上每月要存多少才趕得上 */
  | { kind: "stalled"; neededPerMonth: number | null }
  /** 目標日已過還沒達標 */
  | { kind: "overdue" }
  | {
      kind: "projected";
      /** 預估達標月份 YYYY-MM */
      month: string;
      /** 沒設目標日是 null */
      onTrack: boolean | null;
      lateMonths: number;
      neededPerMonth: number | null;
    };

export interface GoalStatus {
  goal: Goal;
  saved: number;
  target: number;
  remaining: number;
  /** 0–1，超過目標也算 1 */
  ratio: number;
  /** 整數百分比，無條件捨去；達標才會是 100 */
  percent: number;
  achieved: boolean;
  /** 每月存入速度（最近 90 天 ÷ 3） */
  monthlyPace: number;
  forecast: GoalForecast;
}

/** 兩個 YYYY-MM 之間差幾個月（to − from） */
export function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function goalStatus(goal: Goal, progress: GoalProgressRow | undefined, today: string): GoalStatus {
  const saved = round2(progress?.saved ?? 0);
  const target = Number(goal.target_amount);
  const remaining = round2(Math.max(0, target - saved));
  const achieved = goal.achieved_at !== null || saved >= target;
  const ratio = target > 0 ? Math.min(1, Math.max(0, saved / target)) : 1;
  const percent = achieved ? 100 : Math.min(99, Math.floor(ratio * 100));
  const saved90d = Math.max(0, progress?.saved90d ?? 0);
  const monthlyPace = round2(saved90d / 3);
  return { goal, saved, target, remaining, ratio: achieved ? 1 : ratio, percent, achieved, monthlyPace, forecast: forecastFor(goal, remaining, saved90d, achieved, today) };
}

/** saved90d 用原始值算月數（剩餘 × 3 ÷ 90 天增加），避免先把每月速度四捨五入造成多進一個月 */
function forecastFor(goal: Goal, remaining: number, saved90d: number, achieved: boolean, today: string): GoalForecast {
  if (achieved) return { kind: "achieved" };
  const thisMonth = today.slice(0, 7);
  const targetMonth = goal.target_date ? goal.target_date.slice(0, 7) : null;
  if (goal.target_date && goal.target_date < today) return { kind: "overdue" };
  // 目標月份也算一個月可以存（本月到目標月含頭尾）
  const neededPerMonth = targetMonth ? round2(remaining / Math.max(1, monthDiff(thisMonth, targetMonth) + 1)) : null;
  if (saved90d <= 0) return { kind: "stalled", neededPerMonth };
  const month = shiftMonth(thisMonth, Math.ceil(round2((remaining * 3) / saved90d)));
  if (!targetMonth) return { kind: "projected", month, onTrack: null, lateMonths: 0, neededPerMonth: null };
  const late = monthDiff(targetMonth, month);
  return { kind: "projected", month, onTrack: late <= 0, lateMonths: Math.max(0, late), neededPerMonth };
}

/** 卡片上的一句預測 */
export function forecastSentence(status: GoalStatus): string {
  const f = status.forecast;
  switch (f.kind) {
    case "achieved":
      return status.goal.achieved_at ? `${dateShort(status.goal.achieved_at)} 達標` : "達標了！";
    case "overdue":
      return `已過目標日，還差 ${formatTWD(status.remaining)}`;
    case "stalled":
      return f.neededPerMonth !== null
        ? `最近三個月沒有存入；每月要存 ${formatTWD(Math.ceil(f.neededPerMonth))} 才趕得上`
        : "最近三個月沒有存入";
    case "projected":
      if (f.onTrack === null) return `照最近三個月的速度，預計 ${monthLabel(f.month)}達標`;
      if (f.onTrack) return `預計 ${monthLabel(f.month)}達標，趕得上目標日`;
      return `照這速度會晚 ${f.lateMonths} 個月，每月要存 ${formatTWD(Math.ceil(f.neededPerMonth ?? 0))} 才趕得上`;
  }
}

function dateShort(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

/** 面板裡的排序：未達標在前（照 sort_order、建立時間），已達標放最後（最近達標的在前） */
export function sortGoalStatuses(statuses: GoalStatus[]): GoalStatus[] {
  return [...statuses].sort((a, b) => {
    if (a.achieved !== b.achieved) return a.achieved ? 1 : -1;
    if (a.achieved && b.achieved) return (b.goal.achieved_at ?? "").localeCompare(a.goal.achieved_at ?? "");
    if (a.goal.sort_order !== b.goal.sort_order) return a.goal.sort_order - b.goal.sort_order;
    return a.goal.created_at.localeCompare(b.goal.created_at);
  });
}

/**
 * 今天這一頁與封面只顯示一個目標：
 *   1. 今天剛達標的（讓達標章出現在當天）
 *   2. 未達標且有目標日的，取最快到期
 *   3. 未達標的取進度最高（同進度取剩餘最少）
 *   4. 全部都達標了，取最近達標的
 */
export function pickFeaturedGoal(statuses: GoalStatus[], today: string): GoalStatus | null {
  const active = statuses.filter((s) => !s.goal.is_archived);
  if (active.length === 0) return null;
  const justAchieved = active.find((s) => s.goal.achieved_at === today);
  if (justAchieved) return justAchieved;
  const pending = active.filter((s) => !s.achieved);
  const dated = pending.filter((s) => s.goal.target_date).sort((a, b) => a.goal.target_date!.localeCompare(b.goal.target_date!));
  if (dated.length > 0) return dated[0];
  if (pending.length > 0) {
    return [...pending].sort((a, b) => b.ratio - a.ratio || a.remaining - b.remaining)[0];
  }
  return sortGoalStatuses(active)[0];
}

/** 封面標籤下方的一行：「日本旅行 62%」 */
export function coverGoalLine(status: GoalStatus | null): string | null {
  if (!status) return null;
  return `${status.goal.name} ${status.percent}%`;
}

/** 需要寫入 achieved_at 的目標（已存 ≥ 目標，但還沒記達標日） */
export function goalsToMarkAchieved(statuses: GoalStatus[]): GoalStatus[] {
  return statuses.filter((s) => s.goal.achieved_at === null && s.saved >= s.target);
}

export interface SaveAchievementContext {
  kind: "expense" | "income" | "transfer";
  amount: number;
  /** 交易日期 */
  date: string;
  today: string;
  toAccountId: string | null;
  /** 存檔前抓到的目標進度（截至今天） */
  statuses: GoalStatus[] | undefined;
  /** 編輯既有交易時不判斷，避免重複算 */
  isEdit: boolean;
}

/** 這筆收入或轉帳進綁定帳戶後，會不會讓某個目標第一次達標 */
export function goalReachedBySave(ctx: SaveAchievementContext): GoalStatus | null {
  if (ctx.isEdit || !ctx.statuses || !ctx.toAccountId) return null;
  if (ctx.kind === "expense" || ctx.date > ctx.today) return null;
  return (
    ctx.statuses.find(
      (s) => !s.goal.is_archived && !s.achieved && s.goal.account_id === ctx.toAccountId && round2(s.saved + ctx.amount) >= s.target,
    ) ?? null
  );
}

/** 手動存入這筆後會不會第一次達標（存入日期在未來的不算） */
export function goalReachedByDeposit(status: GoalStatus, amount: number, depositDate: string, today: string): boolean {
  return !status.achieved && depositDate <= today && round2(status.saved + amount) >= status.target;
}
