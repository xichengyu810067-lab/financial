import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthView } from "../months/month-view";

export const metadata: Metadata = { title: "本月" };

/** 本月的章節頁：月份以瀏覽器的本地日期為準，所以在瀏覽器端決定 */
export default function CurrentMonthPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <MonthView />
    </ClientOnly>
  );
}
