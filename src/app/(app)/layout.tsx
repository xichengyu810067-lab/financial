import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, requireUser } from "@/lib/auth/dal";

/**
 * 應用頁面的外框。側欄與頂欄是靜態外殼，
 * 登入狀態與引導完成檢查在 <Suspense> 內以串流方式進行（Cache Components 的要求）。
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
          <Suspense fallback={<PageSkeleton />}>
            <AppGate>{children}</AppGate>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

async function AppGate({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile?.onboarded_at) redirect("/onboarding");
  return <>{children}</>;
}

function PageSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
