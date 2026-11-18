"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables, TablesInsert } from "@/lib/supabase/database.types";
import { invalidateAfterWrite } from "./entries";
import { todayISO } from "./format";
import type { InboxItem } from "./inbox-model";

/**
 * 待確認匣、固定支出、自動分類規則的查詢與寫入（里程碑 7）。
 * 確認項目會建立交易，所以除了自己的鍵，也要讓交易、餘額、報表重新抓。
 */

export type RecurringRule = Tables<"recurring_rules">;
export type CategoryRule = Tables<"category_rules">;

export const inboxKeys = {
  pending: (ledgerId: string) => ["inbox", ledgerId, "pending"] as const,
  recurring: (ledgerId: string) => ["inbox", ledgerId, "recurring"] as const,
  rules: (ledgerId: string) => ["inbox", ledgerId, "rules"] as const,
};

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const toNumber = <T extends { amount: number }>(row: T): T => ({ ...row, amount: Number(row.amount) });

// ---------------------------------------------------------------------------
// 待確認項目
// ---------------------------------------------------------------------------

export function usePendingInbox(ledgerId: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.pending(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<InboxItem[]> => {
      const supabase = createClient();
      const rows = check(
        await supabase
          .from("inbox_items")
          .select("*")
          .eq("ledger_id", ledgerId!)
          .eq("status", "pending")
          .order("entry_date")
          .order("created_at"),
      );
      return (rows ?? []).map(toNumber);
    },
  });
}

/** 已經替哪本帳本、哪一天產生過固定支出（同一個分頁不重複呼叫） */
const generated = new Set<string>();

/** 打開今天這一頁或待確認匣時，把到期的固定支出變成待確認項目（錯過的期數一起補上） */
export function useRecurringSync(ledgerId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!ledgerId) return;
    const today = todayISO();
    const key = `${ledgerId}:${today}`;
    if (generated.has(key)) return;
    generated.add(key);
    void (async () => {
      const { data, error } = await createClient().rpc("generate_recurring_items", { p_ledger: ledgerId, p_until: today });
      if (error) {
        generated.delete(key);
        return;
      }
      if (data && data > 0) {
        await queryClient.invalidateQueries({ queryKey: ["inbox", ledgerId] });
      }
    })();
  }, [ledgerId, queryClient]);
}

/** 規則或固定支出改了之後，允許同一天再產生一次 */
function resetSync(ledgerId: string) {
  generated.delete(`${ledgerId}:${todayISO()}`);
}

export function useConfirmInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, payload }: { ledgerId: string; itemId: string; payload: unknown }) => {
      const { data, error } = await createClient().rpc("confirm_inbox_item", { p_item: itemId, p_entry: payload as Json });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    onSuccess: async (_ids, { ledgerId }) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["inbox", ledgerId] }), invalidateAfterWrite(queryClient, ledgerId)]);
    },
  });
}

export function useDismissInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemIds }: { ledgerId: string; itemIds: string[] }) => {
      check(
        await createClient()
          .from("inbox_items")
          .update({ status: "dismissed", resolved_at: new Date().toISOString() })
          .in("id", itemIds)
          .eq("status", "pending"),
      );
    },
    onSuccess: (_r, { ledgerId }) => queryClient.invalidateQueries({ queryKey: inboxKeys.pending(ledgerId) }),
  });
}

// ---------------------------------------------------------------------------
// 固定支出
// ---------------------------------------------------------------------------

export function useRecurringRules(ledgerId: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.recurring(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<RecurringRule[]> => {
      const rows = check(
        await createClient().from("recurring_rules").select("*").eq("ledger_id", ledgerId!).order("is_active", { ascending: false }).order("next_date"),
      );
      return (rows ?? []).map(toNumber);
    },
  });
}

export type RecurringRuleInput = Omit<TablesInsert<"recurring_rules">, "created_at"> & { id?: string };

export function useSaveRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecurringRuleInput) => {
      const supabase = createClient();
      const { id, ...values } = input;
      if (id) check(await supabase.from("recurring_rules").update(values).eq("id", id));
      else check(await supabase.from("recurring_rules").insert(values));
    },
    onSuccess: (_r, input) => {
      resetSync(input.ledger_id);
      return queryClient.invalidateQueries({ queryKey: ["inbox", input.ledger_id] });
    },
  });
}

export function useDeleteRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { ledgerId: string; id: string }) => {
      // 還沒確認的項目跟著規則一起刪（資料庫 on delete cascade）；已入帳的交易不受影響
      check(await createClient().from("recurring_rules").delete().eq("id", id));
    },
    onSuccess: (_r, { ledgerId }) => queryClient.invalidateQueries({ queryKey: ["inbox", ledgerId] }),
  });
}

// ---------------------------------------------------------------------------
// 自動分類規則
// ---------------------------------------------------------------------------

export function useCategoryRules(ledgerId: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.rules(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<CategoryRule[]> =>
      check(await createClient().from("category_rules").select("*").eq("ledger_id", ledgerId!).order("sort_order").order("created_at")) ?? [],
  });
}

export function useSaveCategoryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; pattern: string; categoryId: string; accountId: string | null; sortOrder: number }) => {
      check(
        await createClient().from("category_rules").insert({
          ledger_id: input.ledgerId,
          pattern: input.pattern.trim(),
          category_id: input.categoryId,
          account_id: input.accountId,
          sort_order: input.sortOrder,
        }),
      );
    },
    onSuccess: (_r, { ledgerId }) => queryClient.invalidateQueries({ queryKey: inboxKeys.rules(ledgerId) }),
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { ledgerId: string; id: string }) => {
      check(await createClient().from("category_rules").delete().eq("id", id));
    },
    onSuccess: (_r, { ledgerId }) => queryClient.invalidateQueries({ queryKey: inboxKeys.rules(ledgerId) }),
  });
}
