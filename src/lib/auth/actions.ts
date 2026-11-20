"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "./errors";
import { sanitizeNext } from "./safe-next";
import {
  fieldErrorsOf,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./validation";

/** 表單用 useActionState 收到的狀態 */
export type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** 註冊成功等待信箱確認 / 重設密碼信已寄出 */
  status?: "check-email" | "reset-sent";
  email?: string;
  /** 回填表單值，避免驗證失敗後欄位被清空 */
  values?: Record<string, string>;
} | null;

/** 取得目前請求的來源網址（Vercel 代理時以 x-forwarded-* 為準） */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}


function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    displayName: str(formData, "displayName"),
    email: str(formData, "email"),
    password: str(formData, "password"),
    confirmPassword: str(formData, "confirmPassword"),
  };
  const values = { displayName: raw.displayName, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: parsed.data.displayName ? { display_name: parsed.data.displayName } : undefined,
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: translateAuthError(error), values };

  // 信箱驗證開啟時，重複註冊會回傳沒有 identities 的假使用者。刻意跟新註冊顯示同一個畫面，
  // 不告訴對方「這個信箱已註冊」，避免被拿來試出誰有帳號（確認信畫面會提醒已有帳號的人直接登入）。

  // 若專案關閉了信箱驗證，註冊後會直接有 session
  if (data.session) redirect("/onboarding");

  return { status: "check-email", email: parsed.data.email };
}

export async function resendConfirmation(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = str(formData, "email");
  if (!email) return { error: "缺少 Email" };
  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: translateAuthError(error), status: "check-email", email };
  return { status: "check-email", email };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = { email: str(formData, "email"), password: str(formData, "password") };
  const values = { email: raw.email };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translateAuthError(error), values };

  redirect(sanitizeNext(formData.get("next")));
}

/** Supabase 後台有沒有開 Google；查不到（網路問題）時當作有開，交給 Supabase 處理 */
async function isGoogleEnabled(): Promise<boolean> {
  const { url, key } = getSupabaseEnv();
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return true;
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return settings.external?.google !== false;
  } catch {
    return true;
  }
}

/**
 * 用 Google 登入／註冊：先確認後台已啟用，再導到 Google 授權頁。
 * 授權完回到 /auth/callback（帶 via=google 讓錯誤訊息知道是 Google 流程），
 * 同信箱的 Email 帳號由 Supabase 自動連結成同一個使用者。
 */
export async function signInWithGoogle(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await isGoogleEnabled())) return { error: "Google 登入尚未啟用，請先用 Email 登入" };

  const next = sanitizeNext(formData.get("next"));
  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}&via=google`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return { error: error ? translateAuthError(error) : "Google 登入失敗，請再試一次" };

  redirect(data.url);
}

/**
 * 登出只清掉 session，不在伺服器端導頁：由前端 `useSignOut` 接著清掉查詢快取並整頁導到登入頁，
 * 同一台瀏覽器換人登入時才不會短暫看到上一位的資料。
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = { email: str(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: raw };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: translateAuthError(error), values: raw };
  return { status: "reset-sent", email: parsed.data.email };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = { password: str(formData, "password"), confirmPassword: str(formData, "confirmPassword") };
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: translateAuthError(error) };

  redirect("/today?message=password-updated");
}
