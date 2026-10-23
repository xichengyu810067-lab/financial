import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * 伺服器端（Server Component、Server Action、Route Handler）使用的 Supabase client。
 * 注意：Cache Components 模式下讀取 cookies() 的元件必須放在 <Suspense> 內。
 */
export async function createClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
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
