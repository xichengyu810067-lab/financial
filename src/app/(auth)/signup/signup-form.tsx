"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resendConfirmation, signUp } from "@/lib/auth/actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, null);

  if (state?.status === "check-email" && state.email) {
    return <CheckEmail email={state.email} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>建立帳號</CardTitle>
        <CardDescription>註冊後會寄一封確認信到你的信箱，點擊連結即可開始使用。</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <FormError message={state?.error} />
          <Field label="顯示名稱" htmlFor="displayName" error={state?.fieldErrors?.displayName} hint="選填，之後可在設定頁修改">
            <Input
              id="displayName"
              name="displayName"
              autoComplete="nickname"
              maxLength={40}
              defaultValue={state?.values?.displayName ?? ""}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state?.values?.email ?? ""}
            />
          </Field>
          <Field label="密碼" htmlFor="password" error={state?.fieldErrors?.password} hint="至少 8 碼">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="確認密碼" htmlFor="confirmPassword" error={state?.fieldErrors?.confirmPassword}>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "建立中…" : "建立帳號"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        已經有帳號？
        <Link href="/login" className="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
          登入
        </Link>
      </CardFooter>
    </Card>
  );
}

function CheckEmail({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(resendConfirmation, null);

  return (
    <Card>
      <CardHeader>
        <MailCheck className="mb-2 size-8 text-emerald-600" aria-hidden />
        <CardTitle>確認信已寄出</CardTitle>
        <CardDescription>
          我們寄了一封確認信到 <span className="font-medium text-foreground">{email}</span>
          ，請點擊信中的連結完成註冊。沒收到的話請檢查垃圾郵件匣。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <FormError message={state?.error} />
        {state && !state.error && <p className="text-sm text-emerald-600">已重新寄出確認信。</p>}
        <form action={formAction}>
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="outline" className="w-full" disabled={pending}>
            {pending ? "寄送中…" : "重寄確認信"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          回登入頁
        </Link>
      </CardFooter>
    </Card>
  );
}
