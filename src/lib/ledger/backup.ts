"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { backupFileName, buildBackup, type Backup } from "./backup-model";

/** PostgREST 一次最多回 1000 列，交易與分錄多的帳本要分頁抓 */
const PAGE = 1000;

type Table = "accounts" | "entries" | "entry_lines" | "budgets" | "goals" | "goal_deposits" | "recurring_rules" | "category_rules";

async function fetchAll(table: Table, ledgerId: string): Promise<Record<string, unknown>[]> {
  const supabase = createClient();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").eq("ledger_id", ledgerId).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data as Record<string, unknown>[]));
    if (!data || data.length < PAGE) return rows;
  }
}

/** 在瀏覽器端用 RLS 讀出整本帳本，組成備份物件 */
export async function exportLedger(ledgerId: string) {
  const supabase = createClient();
  const [{ data: ledger, error: ledgerError }, { data: auth }] = await Promise.all([
    supabase.from("ledgers").select("*").eq("id", ledgerId).single(),
    supabase.auth.getUser(),
  ]);
  if (ledgerError) throw new Error(ledgerError.message);
  const profile = auth.user ? (await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle()).data : null;

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

/** 用備份覆蓋目前帳本；成功後重置所有查詢（畫面上的重新抓、其他的下次用到再抓），由呼叫端導回今天這一頁 */
export function useRestoreLedger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ledgerId, backup }: { ledgerId: string; backup: Backup }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("restore_ledger", { p_ledger: ledgerId, p_data: backup as unknown as Json });
      if (error) throw new Error(error.message);
      return data as { entries: number; accounts: number; goals: number };
    },
    onSuccess: () => {
      void queryClient.resetQueries();
    },
  });
}
