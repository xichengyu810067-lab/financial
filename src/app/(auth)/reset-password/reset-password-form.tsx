"use client";

import { useActionState } from "react";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updatePassword } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>設定新密碼</CardTitle>
        <CardDescription>請輸入新的密碼，完成後會直接登入。</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <FormError message={state?.error} />
          <Field label="新密碼" htmlFor="password" error={state?.fieldErrors?.password} hint="至少 8 碼">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="確認新密碼" htmlFor="confirmPassword" error={state?.fieldErrors?.confirmPassword}>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "儲存中…" : "儲存新密碼"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
