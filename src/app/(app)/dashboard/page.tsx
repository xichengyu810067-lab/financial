import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "儀表板" };

export default function DashboardPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full rounded-[22px]" />}>
      <DashboardView />
    </ClientOnly>
  );
}
