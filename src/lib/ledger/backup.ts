"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { backupFileName, buildBackup, type Backup } from "./backup-model";
import { fetchAllRows, unwrap, unwrapOne } from "./db";
import { resetRecurringSync } from "./inbox";

type Table = "accounts" | "entries" | "entry_lines" | "budgets" | "goals" | "goal_deposits" | "recurring_rules" | "category_rules";

/** 交易與分錄多的帳本要分頁抓（PostgREST 一次最多 1000 列） */
async function fetchAll(table: Table, ledgerId: string): Promise<Record<string, unknown>[]> {
  const supabase = createClient();
  return fetchAllRows(
    (from, to) => supabase.from(table).select("*").eq("ledger_id", ledgerId).order("id").range(from, to) as PromiseLike<{
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    }>,
  );
}

/** 在瀏覽器端用 RLS 讀出整本帳本，組成備份物件 */
export async function exportLedger(ledgerId: string) {
  const supabase = createClient();
  const [ledgerResult, { data: auth }] = await Promise.all([supabase.from("ledgers").select("*").eq("id", ledgerId).single(), supabase.auth.getUser()]);
  const ledger = unwrapOne(ledgerResult, "找不到這本帳本");
  const profile = auth.user ? unwrap(await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle()) : null;

  const [accounts, entries, entry_lines, budgets, goals, goal_deposits, recurring_rules, category_rules] = await Promise.all(
    (["accounts", "entries", "entry_lines", "budgets", "goals", "goal_deposits", "recurring_rules", "category_rules"] as const).map((t) =>
      fetchAll(t, ledgerId),
    ),
  );
  return buildBackup({ ledger, profile, accounts, entries, entry_lines, budgets, goals, goal_deposits, recurring_rules, category_rules });
}

/** 匯出並觸發下載；回傳交易筆數給提示用 */
export async function downloadBackup(ledgerId: string): Promise<number> {
  const backup = await exportLedger(ledgerId);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.append(a);
  a.click();
  a.remove();
  // 讓瀏覽器有時間開始下載再釋放
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return backup.entries.length;
}

/**
 * 用備份覆蓋目前帳本；成功後重置所有查詢（畫面上的重新抓、其他的下次用到再抓），由呼叫端導回今天這一頁。
 * 還原會清掉待確認匣，所以也要允許今天再產生一次到期的固定支出。
 */
export function useRestoreLedger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ledgerId, backup }: { ledgerId: string; backup: Backup }) => {
      const supabase = createClient();
      const data = unwrap(await supabase.rpc("restore_ledger", { p_ledger: ledgerId, p_data: backup as unknown as Json }));
      return data as { entries: number; accounts: number; goals: number };
    },
    onSuccess: (_r, { ledgerId }) => {
      resetRecurringSync(ledgerId);
      void queryClient.resetQueries();
    },
  });
}
