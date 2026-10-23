"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/actions";

const LINK_ERRORS: Record<string, string> = {
  otp_expired: "連結已失效，請重新申請確認信或重設密碼。",
  access_denied: "連結已失效或已被使用，請重新申請。",
  link: "連結不正確或已失效，請重新申請。",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/cover";
  const linkError = searchParams.get("error");
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {linkError && !state && <FormError message={LINK_ERRORS[linkError] ?? LINK_ERRORS.link} />}
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
      <Field label="密碼" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
          忘記密碼？
        </Link>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "登入中…" : "登入"}
      </Button>
    </form>
  );
}
