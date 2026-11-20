"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables, TablesInsert } from "@/lib/supabase/database.types";
import { fetchAllRows, unwrap, unwrapRows, withNumericAmount } from "./db";
import { todayISO } from "./format";
import { invalidateAfter } from "./invalidate";
import { keys } from "./keys";
import type { InboxItem } from "./inbox-model";

/**
 * 待確認匣、固定支出、自動分類規則的查詢與寫入（里程碑 7）。
 * 確認項目會建立交易，所以除了自己的鍵，也要讓交易、餘額、報表重新抓。
 */

export type RecurringRule = Tables<"recurring_rules">;
export type CategoryRule = Tables<"category_rules">;

// ---------------------------------------------------------------------------
// 待確認項目
// ---------------------------------------------------------------------------

export function usePendingInbox(ledgerId: string | undefined) {
  return useQuery({
    queryKey: keys.inbox.pending(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<InboxItem[]> => {
      const supabase = createClient();
      // 一次匯入整年的載具發票可能超過 1000 張，分頁抓完
      const rows = await fetchAllRows((from, to) =>
        supabase
          .from("inbox_items")
          .select("*")
          .eq("ledger_id", ledgerId!)
          .eq("status", "pending")
          .order("entry_date")
          .order("created_at")
          .order("id")
          .range(from, to),
      );
      return rows.map(withNumericAmount);
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
        await queryClient.invalidateQueries({ queryKey: keys.inbox.all(ledgerId) });
      }
    })();
  }, [ledgerId, queryClient]);
}

/** 固定支出改了、或還原備份之後，允許同一天再產生一次 */
export function resetRecurringSync(ledgerId: string) {
  generated.delete(`${ledgerId}:${todayISO()}`);
}

export function useConfirmInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, payload }: { ledgerId: string; itemId: string; payload: unknown }) => {
      return unwrap(await createClient().rpc("confirm_inbox_item", { p_item: itemId, p_entry: payload as Json })) ?? [];
    },
    onSuccess: (_ids, { ledgerId }) => invalidateAfter(queryClient, "inboxConfirm", ledgerId),
  });
}

export function useDismissInbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemIds }: { ledgerId: string; itemIds: string[] }) => {
      unwrap(
        await createClient()
          .from("inbox_items")
          .update({ status: "dismissed", resolved_at: new Date().toISOString() })
          .in("id", itemIds)
          .eq("status", "pending"),
      );
    },
    onSuccess: (_r, { ledgerId }) => invalidateAfter(queryClient, "inboxItem", ledgerId),
  });
}

// ---------------------------------------------------------------------------
// 固定支出
// ---------------------------------------------------------------------------

export function useRecurringRules(ledgerId: string | undefined) {
  return useQuery({
    queryKey: keys.inbox.recurring(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<RecurringRule[]> => {
      const rows = unwrapRows(
        await createClient().from("recurring_rules").select("*").eq("ledger_id", ledgerId!).order("is_active", { ascending: false }).order("next_date"),
      );
      return rows.map(withNumericAmount);
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
      if (id) unwrap(await supabase.from("recurring_rules").update(values).eq("id", id));
      else unwrap(await supabase.from("recurring_rules").insert(values));
    },
    onSuccess: (_r, input) => {
      resetRecurringSync(input.ledger_id);
      return invalidateAfter(queryClient, "recurring", input.ledger_id);
    },
  });
}

export function useDeleteRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { ledgerId: string; id: string }) => {
      // 還沒確認的項目跟著規則一起刪（資料庫 on delete cascade）；已入帳的交易不受影響
      unwrap(await createClient().from("recurring_rules").delete().eq("id", id));
    },
    onSuccess: (_r, { ledgerId }) => invalidateAfter(queryClient, "recurring", ledgerId),
  });
}

// ---------------------------------------------------------------------------
// 自動分類規則
// ---------------------------------------------------------------------------

export function useCategoryRules(ledgerId: string | undefined) {
  return useQuery({
    queryKey: keys.inbox.rules(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<CategoryRule[]> =>
      unwrapRows(await createClient().from("category_rules").select("*").eq("ledger_id", ledgerId!).order("sort_order").order("created_at")),
  });
}

export function useSaveCategoryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; pattern: string; categoryId: string; accountId: string | null; sortOrder: number }) => {
      unwrap(
        await createClient().from("category_rules").insert({
          ledger_id: input.ledgerId,
          pattern: input.pattern.trim(),
          category_id: input.categoryId,
          account_id: input.accountId,
          sort_order: input.sortOrder,
        }),
      );
    },
    onSuccess: (_r, { ledgerId }) => invalidateAfter(queryClient, "categoryRule", ledgerId),
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { ledgerId: string; id: string }) => {
      unwrap(await createClient().from("category_rules").delete().eq("id", id));
    },
    onSuccess: (_r, { ledgerId }) => invalidateAfter(queryClient, "categoryRule", ledgerId),
  });
}
