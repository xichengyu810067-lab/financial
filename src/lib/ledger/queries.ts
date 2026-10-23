"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { Account, AccountBalance, Ledger, Profile } from "./types";

/**
 * 瀏覽器端資料存取：所有查詢都走 TanStack Query，寫入後 invalidate 對應的查詢鍵，
 * 畫面（之後包含報表與圖表）就會即時更新。RLS 由 Supabase 保證只看得到自己的資料。
 */

export const queryKeys = {
  profile: ["profile"] as const,
  ledger: ["ledger"] as const,
  accounts: (ledgerId: string) => ["accounts", ledgerId] as const,
  balances: (ledgerId: string) => ["balances", ledgerId] as const,
  openings: (ledgerId: string) => ["openings", ledgerId] as const,
};

/** 有錯就丟出，否則回傳 data（可能為 null，例如 maybeSingle） */
function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** 列表查詢：有錯就丟出，null 視為空陣列 */
function unwrapRows<T>(result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

/** 寫入科目或期初餘額後，讓相關查詢重新抓取 */
export async function invalidateLedgerData(queryClient: QueryClient, ledgerId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts(ledgerId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.balances(ledgerId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.openings(ledgerId) }),
  ]);
}

// ---------------------------------------------------------------------------
// 查詢
// ---------------------------------------------------------------------------

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
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
    queryKey: queryKeys.ledger,
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
    queryKey: queryKeys.accounts(ledgerId ?? ""),
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
    queryKey: queryKeys.balances(ledgerId ?? ""),
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
    queryKey: queryKeys.openings(ledgerId ?? ""),
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
      };
      let id = input.id;
      if (id) {
        unwrap(await supabase.from("accounts").update(payload).eq("id", id));
      } else {
        const row = unwrap(
          await supabase
            .from("accounts")
            .insert({ ...payload, ledger_id: input.ledgerId })
            .select("id")
            .single(),
        );
        if (!row) throw new Error("建立失敗");
        id = row.id;
      }
      if (input.openingAmount !== undefined) {
        unwrap(await supabase.rpc("set_opening_balance", { p_account_id: id, p_amount: input.openingAmount }));
      }
      return id;
    },
    onSuccess: (_id, input) => invalidateLedgerData(queryClient, input.ledgerId),
  });
}

export function useSetArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; ids: string[]; archived: boolean }) => {
      const supabase = createClient();
      unwrap(await supabase.from("accounts").update({ is_archived: input.archived }).in("id", input.ids));
    },
    onSuccess: (_r, input) => invalidateLedgerData(queryClient, input.ledgerId),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; id: string }) => {
      const supabase = createClient();
      unwrap(await supabase.from("accounts").delete().eq("id", input.id));
    },
    onSuccess: (_r, input) => invalidateLedgerData(queryClient, input.ledgerId),
  });
}

export function useMoveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; id: string; direction: "up" | "down" }) => {
      const supabase = createClient();
      unwrap(await supabase.rpc("move_account", { p_account_id: input.id, p_direction: input.direction }));
    },
    onSuccess: (_r, input) => invalidateLedgerData(queryClient, input.ledgerId),
  });
}

export function useUpdateLedger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; start_date?: string }) => {
      const supabase = createClient();
      const { id, ...patch } = input;
      unwrap(await supabase.from("ledgers").update(patch).eq("id", id));
    },
    onSuccess: async (_r, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ledger });
      await invalidateLedgerData(queryClient, input.id);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; display_name?: string; slogan?: string | null }) => {
      const supabase = createClient();
      const { id, ...patch } = input;
      unwrap(await supabase.from("profiles").update(patch).eq("id", id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile }),
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
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
