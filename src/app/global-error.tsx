"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * 根版面本身出錯時的最後一道防線：取代整個 <html>，所以不依賴 Provider 與主題，只用最基本的樣式。
 * 伺服器錯誤只會帶 digest（不外洩細節），可以拿去對照 Vercel 日誌。
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;

  return (
    <html lang="zh-Hant-TW">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <title>發生錯誤</title>
        <main role="alert" className="grid max-w-sm justify-items-center gap-3 text-center">
          <h1 className="text-xl font-bold">網站暫時出了點問題</h1>
          <p className="text-sm text-muted-foreground">請重試；如果一直發生，稍後再回來看看。</p>
          {digest && <p className="font-mono text-xs text-muted-foreground">錯誤代碼 {digest}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => retry()} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              重試
            </button>
            <a href="/today" className="rounded-full border px-4 py-2 text-sm font-bold">
              回到今天
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
