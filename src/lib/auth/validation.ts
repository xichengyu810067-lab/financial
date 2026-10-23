import { z } from "zod";

/** 註冊／登入表單的驗證規則（Server Action 與表單共用） */

const email = z.string().trim().min(1, "請輸入 Email").pipe(z.email("請輸入正確的 Email"));
const password = z.string().min(8, "密碼至少 8 碼").max(72, "密碼最多 72 碼");

export const signUpSchema = z
  .object({
    displayName: z.string().trim().max(40, "顯示名稱最多 40 字"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "兩次輸入的密碼不一致",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "請輸入密碼"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: "兩次輸入的密碼不一致",
    path: ["confirmPassword"],
  });

/** 把 zod 的 issues 轉成 { 欄位: 第一個錯誤訊息 } */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
