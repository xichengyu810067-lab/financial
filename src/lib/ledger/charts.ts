"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { unwrapRows } from "./db";
import { keys } from "./keys";

/** 每個月底的淨值（資產 − 負債），給資產負債表上方的走勢圖 */
export function useNetWorthByMonth(ledgerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: keys.reports.netWorth(ledgerId ?? "", from, to),
    enabled: Boolean(ledgerId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ month: string; netWorth: number }[]> => {
      const supabase = createClient();
      const rows = unwrapRows(await supabase.rpc("net_worth_by_month", { p_ledger: ledgerId!, p_from: from, p_to: to }));
      return rows.map((r) => ({ month: r.month, netWorth: Number(r.net_worth) }));
    },
  });
}
