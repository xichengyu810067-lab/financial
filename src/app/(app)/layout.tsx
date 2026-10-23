import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AddEntryButton } from "@/components/app-shell/add-entry-button";
import { MobileTabBar } from "@/components/app-shell/mobile-tab-bar";
import { TopNav } from "@/components/app-shell/top-nav";
import { EntrySheetProvider } from "@/components/entry/entry-sheet-provider";
import { FeedbackProvider } from "@/components/journal/animations/feedback-provider";
import { PaperPage } from "@/components/journal/paper-page";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, requireUser } from "@/lib/auth/dal";

/**
 * 筆記本內頁的外框：暖灰桌面、頂部分頁（手機改底部四格）、每一頁都是一張米白紙。
 * 登入狀態與引導完成檢查在 <Suspense> 內以串流方式進行（Cache Components 的要求）。
 * EntrySheetProvider 讓任何頁面都能開啟「記一筆」面板。
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <FeedbackProvider>
      <EntrySheetProvider>
        <div className="paper-dots flex min-h-full flex-1 flex-col">
        <TopNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-32 md:px-6 md:pb-14">
          <PaperPage>
            <Suspense fallback={<PageSkeleton />}>
              <AppGate>{children}</AppGate>
            </Suspense>
          </PaperPage>
        </main>
        <MobileTabBar />
        </div>
        <AddEntryButton />
      </EntrySheetProvider>
    </FeedbackProvider>
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
      <Skeleton className="h-32 w-full rounded-[18px]" />
      <Skeleton className="h-32 w-full rounded-[18px]" />
    </div>
  );
}
