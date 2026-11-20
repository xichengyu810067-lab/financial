"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { translateDbError } from "@/lib/ledger/errors";

interface LoadErrorProps {
  /** 例如「報表載入失敗」 */
  title?: string;
  error: unknown;
  onRetry: () => void;
  /** 重試中（按鈕顯示轉圈、不能連按） */
  retrying?: boolean;
  className?: string;
}

/**
 * 資料載入失敗時的提示與重試按鈕：報表、明細面板與 error.tsx 共用。
 * 訊息經過 translateDbError，不直接顯示英文的資料庫錯誤；伺服器錯誤附上 digest 方便對照 Vercel 日誌。
 */
export function LoadError({ title = "資料載入失敗", error, onRetry, retrying = false, className }: LoadErrorProps) {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;
  return (
    <div
      role="alert"
      className={cn("grid justify-items-center gap-3 rounded-xl border border-dashed border-expense/60 bg-expense/5 px-4 py-6 text-center", className)}
    >
      <p className="font-hand text-[18px] font-bold text-expense">{title}</p>
      <p className="text-sm text-muted-foreground">{digest ? "伺服器發生錯誤，請稍後再試。" : translateDbError(error)}</p>
      {digest && <p className="font-mono text-xs text-muted-foreground">錯誤代碼 {digest}</p>}
      <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
        <RotateCcw className={cn(retrying && "animate-spin")} />
        {retrying ? "重新載入中…" : "重試"}
      </Button>
    </div>
  );
}
