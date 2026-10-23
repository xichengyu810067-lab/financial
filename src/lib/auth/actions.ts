"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "./errors";
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

/** 只允許站內相對路徑，避免開放式重導向 */
export async function safeNext(value: unknown, fallback = "/cover"): Promise<string> {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
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

  // 信箱驗證開啟時，重複註冊會回傳沒有 identities 的假使用者
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "此信箱已註冊，請直接登入", values };
  }

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

  redirect(await safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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
