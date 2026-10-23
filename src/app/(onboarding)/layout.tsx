import type { ReactNode } from "react";
import { Logo } from "@/components/journal/logo";

/** 引導頁的簡潔外框：沒有側欄，專注在設定帳本 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="paper-dots flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center px-4 py-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>
    </div>
  );
}
