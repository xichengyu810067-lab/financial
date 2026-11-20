"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { unwrap, unwrapOne, unwrapRows } from "./db";
import { invalidateAfter } from "./invalidate";
import { keys } from "./keys";
import type { Account, AccountBalance, Ledger, Profile } from "./types";

/**
 * 瀏覽器端資料存取：所有查詢都走 TanStack Query，鍵在 ./keys，寫入後要刷新什麼由 ./invalidate 決定。
 * RLS 由 Supabase 保證只看得到自己的資料。
 */

// ---------------------------------------------------------------------------
// 查詢
// ---------------------------------------------------------------------------

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async (): Promise<(Profile & { email: string | null }) | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const profile = unwrap(await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle());
      return profile ? { ...profile, email: user.email ?? null } : null;
    },
  });
}

/** MVP：每位使用者一個帳本，取最早建立的那一個 */
export function useLedger() {
  return useQuery({
    queryKey: keys.ledger,
    queryFn: async (): Promise<Ledger | null> => {
      const supabase = createClient();
      return unwrap(
        await supabase.from("ledgers").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      );
    },
  });
}

export function useAccounts(ledgerId: string | undefined) {
  return useQuery({
    queryKey: keys.accounts(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<Account[]> => {
      const supabase = createClient();
      return unwrapRows(
        await supabase
          .from("accounts")
          .select("*")
          .eq("ledger_id", ledgerId!)
          .order("type")
          .order("sort_order")
          .order("created_at"),
      );
    },
  });
}

export function useBalances(ledgerId: string | undefined) {
  return useQuery({
    queryKey: keys.balances(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<Map<string, AccountBalance>> => {
      const supabase = createClient();
      const rows = unwrapRows(await supabase.from("account_balances").select("*").eq("ledger_id", ledgerId!));
      return new Map(rows.map((r) => [r.account_id!, r]));
    },
  });
}

/** 每個帳戶的期初餘額金額（account_id → amount） */
export function useOpeningBalances(ledgerId: string | undefined) {
  return useQuery({
    queryKey: keys.openings(ledgerId ?? ""),
    enabled: Boolean(ledgerId),
    queryFn: async (): Promise<Map<string, number>> => {
      const supabase = createClient();
      const rows = unwrapRows(
        await supabase
          .from("entries")
          .select("to_account_id, amount")
          .eq("ledger_id", ledgerId!)
          .eq("kind", "opening"),
      );
      return new Map(rows.filter((r) => r.to_account_id).map((r) => [r.to_account_id!, Number(r.amount)]));
    },
  });
}

// ---------------------------------------------------------------------------
// 寫入
// ---------------------------------------------------------------------------

export interface SaveAccountInput {
  id?: string;
  ledgerId: string;
  name: string;
  type: Account["type"];
  subtype?: string | null;
  icon?: string | null;
  color?: string | null;
  parentId?: string | null;
  /** 只有資產／負債帳戶會用到；undefined 代表不更動 */
  openingAmount?: number;
  /** 費用類別的每月基準線；undefined 代表不更動，null 代表清除 */
  monthlyBudget?: number | null;
}

export function useSaveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveAccountInput): Promise<string> => {
      const supabase = createClient();
      const payload = {
        name: input.name.trim(),
        type: input.type,
        subtype: input.subtype ?? null,
        icon: input.icon ?? null,
        color: input.color ?? null,
        parent_id: input.parentId ?? null,
        ...(input.monthlyBudget !== undefined ? { monthly_budget: input.monthlyBudget } : {}),
      };
      let id = input.id;
      if (id) {
        unwrap(await supabase.from("accounts").update(payload).eq("id", id));
      } else {
        const row = unwrapOne(
          await supabase
            .from("accounts")
            .insert({ ...payload, ledger_id: input.ledgerId })
            .select("id")
            .single(),
          "建立失敗",
        );
        id = row.id;
      }
      if (input.openingAmount !== undefined) {
        unwrap(await supabase.rpc("set_opening_balance", { p_account_id: id, p_amount: input.openingAmount }));
      }
      return id;
    },
    onSuccess: (_id, input) => invalidateAfter(queryClient, "account", input.ledgerId),
  });
}

export function useSetArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; ids: string[]; archived: boolean }) => {
      const supabase = createClient();
      unwrap(await supabase.from("accounts").update({ is_archived: input.archived }).in("id", input.ids));
    },
    onSuccess: (_r, input) => invalidateAfter(queryClient, "account", input.ledgerId),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; id: string }) => {
      const supabase = createClient();
      unwrap(await supabase.from("accounts").delete().eq("id", input.id));
    },
    onSuccess: (_r, input) => invalidateAfter(queryClient, "account", input.ledgerId),
  });
}

export function useMoveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; id: string; direction: "up" | "down" }) => {
      const supabase = createClient();
      unwrap(await supabase.rpc("move_account", { p_account_id: input.id, p_direction: input.direction }));
    },
    onSuccess: (_r, input) => invalidateAfter(queryClient, "account", input.ledgerId),
  });
}

export function useUpdateLedger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      start_date?: string;
      cover_color?: string | null;
      cover_material?: string | null;
      monthly_spending_limit?: number | null;
    }) => {
      const supabase = createClient();
      const { id, ...patch } = input;
      unwrap(await supabase.from("ledgers").update(patch).eq("id", id));
    },
    onSuccess: (_r, input) => invalidateAfter(queryClient, "ledger", input.id),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; display_name?: string; slogan?: string | null; animations_enabled?: boolean; carrier_barcode?: string | null }) => {
      const supabase = createClient();
      const { id, ...patch } = input;
      unwrap(await supabase.from("profiles").update(patch).eq("id", id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.profile }),
  });
}

export interface OnboardingAccountInput {
  id: string;
  name: string;
  keep: boolean;
  opening_amount: number;
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; startDate: string; accounts: OnboardingAccountInput[] }) => {
      const supabase = createClient();
      unwrap(
        await supabase.rpc("complete_onboarding", {
          p_name: input.name,
          p_start_date: input.startDate,
          p_accounts: input.accounts as unknown as Json,
        }),
      );
    },
    // 引導會改帳本、科目、期初餘額，全部重抓
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
