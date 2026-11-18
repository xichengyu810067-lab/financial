"use client";

import { useEffect, useMemo, useRef } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { goalStatus, goalsToMarkAchieved, type Goal, type GoalProgressRow, type GoalStatus } from "./goal-model";
import { queryKeys } from "./queries";

/**
 * 儲蓄目標的查詢與寫入。鍵掛在 ["reports", ledgerId] 底下：記帳（轉帳進綁定帳戶）後進度跟著重算，
 * 目標或存入寫入後也 invalidate 同一個前綴。
 */

export const goalKeys = {
  statuses: (ledgerId: string, asOf: string) => [...queryKeys.reports(ledgerId), "goals", asOf] as const,
};

interface GoalsData {
  goals: Goal[];
  progress: GoalProgressRow[];
}

/** 全部目標（含封存）與截至某天的進度 */
export function useGoalStatuses(ledgerId: string | undefined, asOf: string) {
  const query = useQuery({
    queryKey: goalKeys.statuses(ledgerId ?? "", asOf),
    enabled: Boolean(ledgerId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GoalsData> => {
      const supabase = createClient();
      const [goals, progress] = await Promise.all([
        supabase.from("goals").select("*").eq("ledger_id", ledgerId!).order("sort_order").order("created_at"),
        supabase.rpc("goal_progress", { p_ledger: ledgerId!, p_as_of: asOf }),
      ]);
      if (goals.error) throw new Error(goals.error.message);
      if (progress.error) throw new Error(progress.error.message);
      return {
        goals: (goals.data ?? []).map((g) => ({ ...g, target_amount: Number(g.target_amount) })),
        progress: (progress.data ?? []).map((r) => ({ goalId: r.goal_id, saved: Number(r.saved), saved90d: Number(r.saved_90d) })),
      };
    },
  });

  const statuses = useMemo<GoalStatus[] | undefined>(() => {
    if (!query.data) return undefined;
    const byId = new Map(query.data.progress.map((p) => [p.goalId, p]));
    return query.data.goals.map((g) => goalStatus(g, byId.get(g.id), asOf));
  }, [query.data, asOf]);

  useMarkAchieved(ledgerId, statuses, asOf);

  return { ...query, statuses };
}

/** 第一次看到「已存 ≥ 目標」就把 achieved_at 寫成那天；同一個目標只送一次 */
function useMarkAchieved(ledgerId: string | undefined, statuses: GoalStatus[] | undefined, asOf: string) {
  const queryClient = useQueryClient();
  const sent = useRef(new Set<string>());
  useEffect(() => {
    if (!ledgerId || !statuses) return;
    const ids = goalsToMarkAchieved(statuses)
      .map((s) => s.goal.id)
      .filter((id) => !sent.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => sent.current.add(id));
    const supabase = createClient();
    void supabase
      .from("goals")
      .update({ achieved_at: asOf })
      .in("id", ids)
      .is("achieved_at", null)
      .then(({ error }) => {
        if (error) {
          ids.forEach((id) => sent.current.delete(id));
          return;
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.reports(ledgerId) });
      });
  }, [ledgerId, statuses, asOf, queryClient]);
}

export interface SaveGoalInput {
  id?: string;
  ledgerId: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  /** null = 手動存入 */
  accountId: string | null;
  note: string | null;
  /** 新增時排在最後 */
  sortOrder?: number;
  /** 編輯時把目標金額調高：清掉達標日，重新判斷 */
  resetAchieved?: boolean;
}

export function useSaveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveGoalInput) => {
      const supabase = createClient();
      const row = {
        name: input.name.trim(),
        target_amount: input.targetAmount,
        target_date: input.targetDate,
        account_id: input.accountId,
        note: input.note?.trim() || null,
      };
      if (input.id) {
        const { error } = await supabase
          .from("goals")
          .update(input.resetAchieved ? { ...row, achieved_at: null } : row)
          .eq("id", input.id);
        if (error) throw new Error(error.message);
        return input.id;
      }
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...row, ledger_id: input.ledgerId, sort_order: input.sortOrder ?? 0 })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    onSuccess: (_id, input) => queryClient.invalidateQueries({ queryKey: queryKeys.reports(input.ledgerId) }),
  });
}

export function useAddDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; goalId: string; amount: number; date: string; note: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.from("goal_deposits").insert({
        ledger_id: input.ledgerId,
        goal_id: input.goalId,
        amount: input.amount,
        deposit_date: input.date,
        note: input.note?.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, input) => queryClient.invalidateQueries({ queryKey: queryKeys.reports(input.ledgerId) }),
  });
}

export function useArchiveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; goalId: string; archived: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase.from("goals").update({ is_archived: input.archived }).eq("id", input.goalId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, input) => queryClient.invalidateQueries({ queryKey: queryKeys.reports(input.ledgerId) }),
  });
}
