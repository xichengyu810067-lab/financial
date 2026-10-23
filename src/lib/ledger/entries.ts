"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { buildLines, type AccountRef, type Line } from "./posting";
import { queryKeys } from "./queries";
import type { Account } from "./types";

export type Entry = Tables<"entries">;
export type EntryKind = Entry["kind"];
export type SimpleKind = "expense" | "income" | "transfer";

export const KIND_LABELS: Record<EntryKind, string> = {
  expense: "支出",
  income: "收入",
  transfer: "轉帳",
  opening: "期初餘額",
  adjustment: "調整",
};

// ---------------------------------------------------------------------------
// 月份工具（YYYY-MM）
// ---------------------------------------------------------------------------

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y} 年 ${Number(m)} 月`;
}

const dayFormatter = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" });

/** "2026-10-23" → "10月23日 週四" */
export function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return dayFormatter.format(new Date(y, m - 1, d));
}

// ---------------------------------------------------------------------------
// 查詢
// ---------------------------------------------------------------------------

export const entryKeys = {
  all: (ledgerId: string) => ["entries", ledgerId] as const,
  month: (ledgerId: string, month: string) => ["entries", ledgerId, month] as const,
};

function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** 某月份的交易（不含期初餘額），日期與建立時間都降冪 */
export function useEntries(ledgerId: string | undefined, month: string) {
  return useQuery({
    queryKey: entryKeys.month(ledgerId ?? "", month),
    enabled: Boolean(ledgerId) && isValidMonth(month),
    queryFn: async (): Promise<Entry[]> => {
      const supabase = createClient();
      const { start, end } = monthRange(month);
      const rows = unwrap(
        await supabase
          .from("entries")
          .select("*")
          .eq("ledger_id", ledgerId!)
          .neq("kind", "opening")
          .gte("entry_date", start)
          .lte("entry_date", end)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false }),
      );
      return (rows ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
    },
  });
}

// ---------------------------------------------------------------------------
// 寫入
// ---------------------------------------------------------------------------

export interface SaveEntryInput {
  id?: string;
  ledgerId: string;
  kind: SimpleKind;
  date: string;
  amount: number;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  categoryId?: string | null;
  memo?: string | null;
  /** 用來查科目類型以產生分錄 */
  accountsById: Map<string, Account>;
}

function ref(accountsById: Map<string, Account>, id: string | null | undefined, label: string): AccountRef {
  const account = id ? accountsById.get(id) : undefined;
  if (!account) throw new Error(`請選擇${label}`);
  return { id: account.id, type: account.type, name: account.name };
}

/** 依交易種類組出分錄行（表單預覽與儲存共用） */
export function linesForEntry(input: Omit<SaveEntryInput, "id" | "ledgerId" | "date" | "memo">): Line[] {
  switch (input.kind) {
    case "expense":
      return buildLines({
        kind: "expense",
        amount: input.amount,
        fromAccount: ref(input.accountsById, input.fromAccountId, "付款帳戶"),
        category: ref(input.accountsById, input.categoryId, "類別"),
      });
    case "income":
      return buildLines({
        kind: "income",
        amount: input.amount,
        toAccount: ref(input.accountsById, input.toAccountId, "存入帳戶"),
        category: ref(input.accountsById, input.categoryId, "類別"),
      });
    case "transfer":
      return buildLines({
        kind: "transfer",
        amount: input.amount,
        fromAccount: ref(input.accountsById, input.fromAccountId, "轉出帳戶"),
        toAccount: ref(input.accountsById, input.toAccountId, "轉入帳戶"),
      });
  }
}

async function invalidateAfterWrite(queryClient: ReturnType<typeof useQueryClient>, ledgerId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entryKeys.all(ledgerId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.balances(ledgerId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.openings(ledgerId) }),
  ]);
}

export function useSaveEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveEntryInput): Promise<string> => {
      const lines = linesForEntry(input);
      const supabase = createClient();
      const entry = {
        id: input.id ?? null,
        ledger_id: input.ledgerId,
        kind: input.kind,
        entry_date: input.date,
        amount: input.amount,
        from_account_id: input.kind === "income" ? null : (input.fromAccountId ?? null),
        to_account_id: input.kind === "expense" ? null : (input.toAccountId ?? null),
        category_id: input.kind === "transfer" ? null : (input.categoryId ?? null),
        memo: input.memo?.trim() || null,
      };
      const id = unwrap(
        await supabase.rpc("save_entry", {
          p_entry: entry as unknown as Json,
          p_lines: lines.map((l) => ({ account_id: l.accountId, debit: l.debit, credit: l.credit })) as unknown as Json,
        }),
      );
      if (!id) throw new Error("儲存失敗，請再試一次");
      return id;
    },
    onSuccess: (_id, input) => invalidateAfterWrite(queryClient, input.ledgerId),
  });
}

export function useDeleteEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; ids: string[] }) => {
      if (input.ids.length === 0) return;
      const supabase = createClient();
      unwrap(await supabase.from("entries").delete().in("id", input.ids));
    },
    onSuccess: (_r, input) => invalidateAfterWrite(queryClient, input.ledgerId),
  });
}
