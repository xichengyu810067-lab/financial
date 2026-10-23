import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardView } from "../dashboard/dashboard-view";

export const metadata: Metadata = { title: "今天" };

/** 今天這一頁；「一天一頁」在下一個 PR 實作，這裡先放總覽 */
export default function TodayPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <DashboardView />
    </ClientOnly>
  );
}
