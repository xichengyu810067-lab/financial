"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { CategoryStat } from "./alerts";
import { queryKeys } from "./queries";

/**
 * 一天一頁用的查詢。鍵都掛在 ["reports", ledgerId] 底下，任何寫入後一併重算。
 */

export const dayKeys = {
  daily: (ledgerId: string, from: string, to: string) => [...queryKeys.reports(ledgerId), "daily", from, to] as const,
  stats: (ledgerId: string, asOf: string) => [...queryKeys.reports(ledgerId), "category-stats", asOf] as const,
};

export interface DailySummaryRow {
  /** YYYY-MM-DD */
  day: string;
  income: number;
  expense: number;
  entryCount: number;
}

function unwrapRows<T>(result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

/** 期間內每一天的收入、支出與筆數（沒交易的日子不會有列） */
export function useDailySummary(ledgerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: dayKeys.daily(ledgerId ?? "", from, to),
    enabled: Boolean(ledgerId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DailySummaryRow[]> => {
      const supabase = createClient();
      const rows = unwrapRows(await supabase.rpc("daily_summary", { p_ledger: ledgerId!, p_from: from, p_to: to }));
      return rows.map((r) => ({ day: r.day, income: Number(r.income), expense: Number(r.expense), entryCount: r.entry_count }));
    },
  });
}

/** 截至某天的費用類別統計（花過頭判斷用） */
export function useCategoryStats(ledgerId: string | undefined, asOf: string) {
  return useQuery({
    queryKey: dayKeys.stats(ledgerId ?? "", asOf),
    enabled: Boolean(ledgerId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CategoryStat[]> => {
      const supabase = createClient();
      const rows = unwrapRows(await supabase.rpc("category_spending_stats", { p_ledger: ledgerId!, p_as_of: asOf }));
      return rows.map((r) => ({
        account_id: r.account_id,
        parent_id: r.parent_id ?? null,
        name: r.name,
        icon: r.icon ?? null,
        color: r.color ?? null,
        is_archived: r.is_archived,
        sort_order: r.sort_order,
        monthly_budget: r.monthly_budget === null ? null : Number(r.monthly_budget),
        month_to_date: Number(r.month_to_date),
        month_count: r.month_count,
        prev3_avg: Number(r.prev3_avg),
        prev3_months: r.prev3_months,
        recent_avg_entry: Number(r.recent_avg_entry),
        recent_count: r.recent_count,
      }));
    },
  });
}
