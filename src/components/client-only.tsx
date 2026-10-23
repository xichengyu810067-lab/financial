"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/**
 * 只在瀏覽器端渲染 children，伺服器與 hydration 階段先顯示 fallback。
 * 用途：TanStack Query 等會在 render 時讀 Date.now() 的程式庫，
 * 不能出現在 Cache Components 的靜態預渲染中；使用者資料本來就要在瀏覽器端抓。
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return <>{isClient ? children : fallback}</>;
}
