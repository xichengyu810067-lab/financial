import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "報表" };

export default function ReportsPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <ReportsView />
    </ClientOnly>
  );
}
