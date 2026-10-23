import { evaluateSpendingAlerts, type CategoryStat, type SpendingAlert } from "./alerts";
import type { Entry, SimpleKind } from "./entries";
import { round2 } from "./report-model";
import type { Account } from "./types";

/**
 * 記帳後要播哪一段動畫（純函式，Vitest）：
 *   收入、轉帳到儲蓄或投資帳戶 → 存錢（硬幣掉進撲滿）
 *   一般支出、其他轉帳 → 「已記」印章
 *   支出讓本月速度超過基準線 30%，或是單筆大額 → 紙鈔飛走 + 橙色印章 + 一句提醒
 */

export type FeedbackKind = "saving" | "stamp" | "overspend";

export interface Feedback {
  kind: FeedbackKind;
  amount: number;
  /** 動畫旁顯示的名稱（類別或帳戶） */
  label: string;
  /** 超支時的提醒 */
  alert?: SpendingAlert;
}

/** 轉進這些子類型的資產帳戶算存錢 */
export const SAVING_SUBTYPES = new Set(["savings", "investment"]);

export interface SaveContext {
  kind: SimpleKind;
  amount: number;
  /** 交易日期 */
  date: string;
  today: string;
  category?: Account | null;
  toAccount?: Account | null;
  /** 存檔前抓到的、截至今天的類別統計；沒有就不判斷超支 */
  stats?: CategoryStat[];
  /** 編輯既有交易時的原值，避免本月至今重複加 */
  previous?: { amount: number; date: string; categoryId: string | null } | null;
}

export function feedbackForSave(ctx: SaveContext): Feedback {
  if (ctx.kind === "income") {
    return { kind: "saving", amount: ctx.amount, label: ctx.category?.name ?? "收入" };
  }
  if (ctx.kind === "transfer") {
    const to = ctx.toAccount;
    const saving = Boolean(to && to.type === "asset" && SAVING_SUBTYPES.has(to.subtype ?? ""));
    return { kind: saving ? "saving" : "stamp", amount: ctx.amount, label: to?.name ?? "轉帳" };
  }
  const label = ctx.category?.name ?? "支出";
  const alert = overspendAfter(ctx);
  return alert ? { kind: "overspend", amount: ctx.amount, label, alert } : { kind: "stamp", amount: ctx.amount, label };
}

/** 把這筆加進統計後，這個類別（或它的父類別）會不會變成紅色或單筆大額 */
function overspendAfter(ctx: SaveContext): SpendingAlert | undefined {
  const category = ctx.category;
  if (!ctx.stats || !category) return undefined;
  const currentMonth = ctx.today.slice(0, 7);
  if (ctx.date.slice(0, 7) !== currentMonth) return undefined;

  const previousInMonth = ctx.previous && ctx.previous.categoryId === category.id && ctx.previous.date.slice(0, 7) === currentMonth ? ctx.previous : null;
  const delta = round2(ctx.amount - (previousInMonth?.amount ?? 0));
  const countDelta = previousInMonth ? 0 : 1;

  let found = false;
  const adjusted = ctx.stats.map((s) => {
    if (s.account_id !== category.id) return s;
    found = true;
    return { ...s, month_to_date: round2(s.month_to_date + delta), month_count: s.month_count + countDelta };
  });
  if (!found) {
    adjusted.push({
      account_id: category.id,
      parent_id: category.parent_id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      is_archived: category.is_archived,
      sort_order: category.sort_order,
      monthly_budget: category.monthly_budget,
      month_to_date: ctx.amount,
      month_count: 1,
      prev3_avg: 0,
      prev3_months: 0,
      recent_avg_entry: 0,
      recent_count: 0,
    });
  }

  const pseudo = {
    id: "pending",
    ledger_id: category.ledger_id,
    kind: "expense",
    entry_date: ctx.date,
    amount: ctx.amount,
    category_id: category.id,
    from_account_id: null,
    to_account_id: null,
    memo: null,
    created_by: "",
    created_at: "",
    updated_at: "",
  } satisfies Entry;

  const relevant = new Set([category.id, category.parent_id].filter((id): id is string => Boolean(id)));
  return evaluateSpendingAlerts(adjusted, [pseudo], ctx.today).find(
    (a) => (a.level === "red" || a.level === "large") && relevant.has(a.categoryId),
  );
}
