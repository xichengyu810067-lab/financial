import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 信箱確認、重設密碼等連結會導回這裡，帶著一次性的 code。
 * 交換成 session 後，導到 next 指定的站內頁面。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  // Vercel 代理後 request.url 可能是內部位址，以 x-forwarded-host 為準
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin = forwardedHost ? `https://${forwardedHost}` : new URL(request.url).origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Supabase 也可能直接帶 error 參數回來（例如連結過期）
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error") ?? "link";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorCode)}`);
}
