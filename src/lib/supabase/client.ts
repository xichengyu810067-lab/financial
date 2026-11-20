import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * 瀏覽器端（Client Component）使用的 Supabase client；@supabase/ssr 會在瀏覽器內重用同一個實例。
 *
 * 關掉 postgrest-js 內建的重試（GET 斷線時會自己再送 3 次、等 1+2+4 秒）：
 * 重試統一交給 TanStack Query（providers.tsx，2 次），不然兩層疊起來要等二十幾秒才看得到錯誤畫面。
 */
export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient<Database>(url, key, { db: { retry: false } });
}

export type BrowserSupabaseClient = ReturnType<typeof createClient>;
