"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);
  const sent = state?.status === "reset-sent";

  return (
    <Card>
      <CardHeader>
        <CardTitle>忘記密碼</CardTitle>
        <CardDescription>
          {sent
            ? `如果 ${state?.email} 有註冊過，我們已寄出重設密碼的連結，請到信箱查看。`
            : "輸入註冊時的 Email，我們會寄一封重設密碼的連結給你。"}
        </CardDescription>
      </CardHeader>
      {!sent && (
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <FormError message={state?.error} />
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
            <Button type="submit" disabled={pending}>
              {pending ? "寄送中…" : "寄送重設連結"}
            </Button>
          </form>
        </CardContent>
      )}
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          回登入頁
        </Link>
      </CardFooter>
    </Card>
  );
}
