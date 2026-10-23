import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * 伺服器端（Server Component、Server Action、Route Handler）使用的 Supabase client。
 *
 * Cache Components 注意事項：
 * - 呼叫這個函式的 Server Component 必須放在 <Suspense> 內。
 * - 先 `await connection()` 把後續程式明確標為「請求時才執行」，
 *   否則 supabase-js 在檢查 session 到期時呼叫的 Date.now() 會被分段渲染視為同步 IO 錯誤。
 */
export async function createClient() {
  await connection();
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 從 Server Component 呼叫時無法寫入 cookie；session 刷新交給 src/proxy.ts 處理
        }
      },
    },
  });
}
