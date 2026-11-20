"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTransition } from "react";
import { signOut } from "./actions";

/**
 * 登出：清掉伺服器 session → 清掉前端所有查詢快取 → 整頁導到登入頁。
 * 整頁導頁會連同模組層級的狀態（例如當天已產生固定支出的記號）一起重置，
 * 同一台瀏覽器換人登入時不會先看到上一位的名稱、信箱或帳本。
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const [signingOut, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      try {
        await signOut();
      } finally {
        queryClient.clear();
        window.location.replace("/login");
      }
    });

  return { signingOut, signOut: run };
}
