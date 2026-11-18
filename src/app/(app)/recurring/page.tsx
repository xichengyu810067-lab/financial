import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { RecurringView } from "./recurring-view";

export const metadata: Metadata = { title: "固定支出" };

export default function RecurringPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <RecurringView />
    </ClientOnly>
  );
}
