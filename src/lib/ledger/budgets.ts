"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { unwrap } from "./db";
import { invalidateAfter } from "./invalidate";

/**
 * 當月預算覆寫（budgets 表，month = 當月 1 日）。
 * amount 為 null 代表清掉覆寫，回到類別基準線。寫入後 invalidate 報表前綴，月章節頁與警示一起重算。
 */
export function useUpsertMonthBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ledgerId: string; categoryId: string; month: string; amount: number | null }) => {
      const supabase = createClient();
      const monthStart = `${input.month.slice(0, 7)}-01`;
      if (input.amount === null) {
        unwrap(await supabase.from("budgets").delete().eq("ledger_id", input.ledgerId).eq("category_id", input.categoryId).eq("month", monthStart));
        return;
      }
      unwrap(
        await supabase
          .from("budgets")
          .upsert({ ledger_id: input.ledgerId, category_id: input.categoryId, month: monthStart, amount: input.amount }, { onConflict: "ledger_id,category_id,month" }),
      );
    },
    onSuccess: (_r, input) => invalidateAfter(queryClient, "budget", input.ledgerId),
  });
}
