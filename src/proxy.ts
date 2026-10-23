import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Next.js 16 的 Proxy（舊稱 Middleware）。
 * 1. 刷新 Supabase session cookie，讓 Server Component 讀到最新登入狀態。
 * 2. 未登入者不得進入應用頁面；已登入者不需要再看登入／註冊頁。
 */

const PROTECTED_PREFIXES = [
  "/cover",
  "/today",
  "/days",
  "/month",
  "/months",
  "/year",
  "/dashboard",
  "/transactions",
  "/accounts",
  "/categories",
  "/reports",
  "/budgets",
  "/settings",
  "/onboarding",
  "/reset-password",
];

const AUTH_PAGES = new Set(["/login", "/signup", "/forgot-password"]);

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

  // 驗證並在需要時刷新 token
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isLoggedIn && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // 重設密碼頁需要帶 recovery session，沒有就回登入頁，不保留 next
    if (pathname !== "/reset-password") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && (AUTH_PAGES.has(pathname) || pathname === "/")) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/cover";
    appUrl.search = "";
    return NextResponse.redirect(appUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // 排除靜態資源與圖片，其餘路徑都經過 proxy
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
