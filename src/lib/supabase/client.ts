import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/** 瀏覽器端（Client Component）使用的 Supabase client；@supabase/ssr 會在瀏覽器內重用同一個實例 */
export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient<Database>(url, key);
}

export type BrowserSupabaseClient = ReturnType<typeof createClient>;
