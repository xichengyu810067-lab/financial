import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 信箱確認、重設密碼等連結會導回這裡，帶著一次性的 code。
 * Google 登入授權完也回到這裡（帶 via=google）。
 * 交換成 session 後，導到 next 指定的站內頁面；還沒完成引導的由 (app)/(book) layout 導去 /onboarding。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/cover";

  // Vercel 代理後 request.url 可能是內部位址，以 x-forwarded-host／proto 為準（本機 next dev 是 http）
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const origin = forwardedHost ? `${proto}://${forwardedHost}` : requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Supabase 也可能直接帶 error 參數回來（例如連結過期、使用者在 Google 按了取消）
  if (searchParams.get("via") === "google") {
    const cancelled = searchParams.get("error") === "access_denied";
    return NextResponse.redirect(`${origin}/login?error=${cancelled ? "google_cancelled" : "google"}`);
  }
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error") ?? "link";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorCode)}`);
}
