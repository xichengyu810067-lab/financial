import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>登入</CardTitle>
        <CardDescription>使用 Email 與密碼登入你的帳本。</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-44 w-full" />}>
          <LoginForm />
        </Suspense>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        還沒有帳號？
        <Link href="/signup" className="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
          免費註冊
        </Link>
      </CardFooter>
    </Card>
  );
}
