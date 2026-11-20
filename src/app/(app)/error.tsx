"use client";

import { useEffect } from "react";
import { LoadError } from "@/components/load-error";

/**
 * 筆記本內頁的錯誤畫面：頂部分頁與記帳按鈕都還在，只有這一頁換成錯誤與重試。
 * 頁面主要資料載入失敗（throwIfFailed）或畫面程式出錯時會來到這裡。
 * 重試會重新渲染這一頁；失敗的查詢在重新掛載時會再抓一次。
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <LoadError title="這一頁載入失敗" error={error} onRetry={retry} className="my-6" />;
}
