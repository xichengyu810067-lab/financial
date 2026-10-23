"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "./queries";

/** 每個月底的淨值（資產 − 負債），給年度封底的走勢圖 */
export function useNetWorthByMonth(ledgerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: [...queryKeys.reports(ledgerId ?? ""), "net-worth", from, to] as const,
    enabled: Boolean(ledgerId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ month: string; netWorth: number }[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("net_worth_by_month", { p_ledger: ledgerId!, p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ month: r.month, netWorth: Number(r.net_worth) }));
    },
  });
}
