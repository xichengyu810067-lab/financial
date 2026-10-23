"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Entry } from "./entries";
import { queryKeys } from "./queries";
import type { Activity, BalanceRow, CashFlowRow, IncomeRow } from "./report-model";

/**
 * 三大報表的查詢。查詢鍵都以 ["reports", ledgerId] 開頭，
 * 任何交易、科目或期初餘額寫入後 invalidate 這個前綴，報表就會重算。
 * 切換期間時先顯示上一個期間的資料（keepPreviousData），避免整頁閃骨架。
 */

export const reportKeys = {
  income: (ledgerId: string, from: string, to: string) => [...queryKeys.reports(ledgerId), "income", from, to] as const,
  balance: (ledgerId: string, asOf: string) => [...queryKeys.reports(ledgerId), "balance", asOf] as const,
  cashflow: (ledgerId: string, from: string, to: string) => [...queryKeys.reports(ledgerId), "cashflow", from, to] as const,
  monthly: (ledgerId: string, from: string, to: string) => [...queryKeys.reports(ledgerId), "monthly", from, to] as const,
  entries: (ledgerId: string, from: string, to: string) => [...queryKeys.reports(ledgerId), "entries", from, to] as const,
};

function unwrapRows<T>(result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export function useIncomeStatement(ledgerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: reportKeys.income(ledgerId ?? "", from, to),
    enabled: Boolean(ledgerId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<IncomeRow[]> => {
      const supabase = createClient();
      const rows = unwrapRows(await supabase.rpc("report_income_statement", { p_ledger: ledgerId!, p_from: from, p_to: to }));
      return rows.map((r) => ({ ...r, type: r.type as IncomeRow["type"], amount: Number(r.amount) }));
    },
  });
}

export function useBalanceSheet(ledgerId: string | undefined, asOf: string) {
  return useQuery({
    queryKey: reportKeys.balance(ledgerId ?? "", asOf),
    enabled: Boolean(ledgerId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BalanceRow[]> => {
      const supabase = createClient();
      const rows = unwrapRows(await supabase.rpc("report_balance_sheet", { p_ledger: ledgerId!, p_as_of: asOf }));
      return rows.map((r) => ({ ...r, type: r.type as BalanceRow["type"], balance: Number(r.balance) }));
    },
  });
}

export function useCashFlow(ledgerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: reportKeys.cashflow(ledgerId ?? "", from, to),
    enabled: Boolean(ledgerId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CashFlowRow[]> => {
      const supabase = createClient();
      const rows = unwrapRows(await supabase.rpc("report_cash_flow", { p_ledger: ledgerId!, p_from: from, p_to: to }));
      return rows.map((r) => ({
        ...r,
        section: r.section as CashFlowRow["section"],
        activity: (r.activity as Activity | null) ?? null,
        inflow: Number(r.inflow),
        outflow: Number(r.outflow),
      }));
    },
  });
}

export interface MonthlySummaryRow {
  /** YYYY-MM */
  month: string;
  income: number;
  expense: number;
}

export function useMonthlySummary(ledgerId: string | undefined, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.monthly(ledgerId ?? "", from, to),
    enabled: Boolean(ledgerId) && enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MonthlySummaryRow[]> => {
      const supabase = createClient();
      const rows = unwrapRows(await supabase.rpc("monthly_summary", { p_ledger: ledgerId!, p_from: from, p_to: to }));
      return rows.map((r) => ({ month: r.month, income: Number(r.income), expense: Number(r.expense) }));
    },
  });
}

/** 期間內所有交易（含期初餘額），供三張報表的明細面板在前端依科目篩選 */
export function useEntriesInRange(ledgerId: string | undefined, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.entries(ledgerId ?? "", from, to),
    enabled: Boolean(ledgerId) && enabled,
    queryFn: async (): Promise<Entry[]> => {
      const supabase = createClient();
      const rows = unwrapRows(
        await supabase
          .from("entries")
          .select("*")
          .eq("ledger_id", ledgerId!)
          .gte("entry_date", from)
          .lte("entry_date", to)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false }),
      );
      return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
    },
  });
}
