import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { DayView } from "../days/day-view";

export const metadata: Metadata = { title: "今天" };

/** 今天這一頁：日期以瀏覽器的本地日期為準，所以在瀏覽器端決定 */
export default function TodayPage() {
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <DayView />
    </ClientOnly>
  );
}
