"use client";

import { useEffect } from "react";
import { LoadError } from "@/components/load-error";

/** 封面、登入、引導等筆記本內頁以外的錯誤畫面（內頁有自己的 (app)/error.tsx，保留頂部分頁） */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <LoadError title="這一頁載入失敗" error={error} onRetry={retry} />
    </main>
  );
}
