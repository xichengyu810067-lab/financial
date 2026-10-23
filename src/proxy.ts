import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Next.js 16 的 Proxy（舊稱 Middleware）。
 * 目前只負責刷新 Supabase session cookie，讓 Server Component 讀到最新登入狀態；
 * 「未登入導向 /login」等規則在里程碑 1 設計登入流程時再加入。
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // 驗證並在需要時刷新 token；回傳值目前不使用
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // 排除靜態資源與圖片，其餘路徑都經過 proxy
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
