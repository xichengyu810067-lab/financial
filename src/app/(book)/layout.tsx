import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { UserMenu } from "@/components/app-shell/user-menu";
import { ClientOnly } from "@/components/client-only";
import { Logo } from "@/components/journal/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, requireUser } from "@/lib/auth/dal";

/** 封面頁的外框：只有桌面與頂欄，沒有分頁；翻開後才進到內頁外框 */
export default function BookLayout({ children }: { children: ReactNode }) {
  return (
    <div className="paper-dots flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ClientOnly fallback={<Skeleton className="h-8 w-24 rounded-full" />}>
            <UserMenu />
          </ClientOnly>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 md:px-6">
        <Suspense fallback={<Skeleton className="mx-auto mt-10 h-[544px] w-[420px] max-w-full rounded-[18px]" />}>
          <BookGate>{children}</BookGate>
        </Suspense>
      </main>
    </div>
  );
}

async function BookGate({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile?.onboarded_at) redirect("/onboarding");
  return <>{children}</>;
}
