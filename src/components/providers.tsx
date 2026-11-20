"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

/**
 * 全站 Provider：
 * - TanStack Query：所有資料查詢走這裡，交易寫入後 invalidate 查詢鍵即可讓報表與圖表即時更新。
 *   失敗會自動重試 2 次（約 3 秒），還是失敗就交給頁面的錯誤畫面（throwIfFailed → error.tsx）。
 * - Sonner Toaster：操作成功 / 失敗提示。
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 2 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
