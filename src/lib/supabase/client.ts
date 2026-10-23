import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** 瀏覽器端（Client Component）使用的 Supabase client */
export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
}
