import Link from "next/link";
import type { ReactNode } from "react";

/** 登入／註冊等頁面的置中外框 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          財報記帳平台
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
