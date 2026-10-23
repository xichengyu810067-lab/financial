import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { YearView } from "./year-view";

export const metadata: Metadata = { title: "年度總覽" };

/** 今年的封底：年份以瀏覽器的本地日期為準 */
export default function CurrentYearPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <YearView />
    </ClientOnly>
  );
}
