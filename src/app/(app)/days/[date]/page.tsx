import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { isValidISODate } from "@/lib/ledger/period";
import { DayView } from "../day-view";

interface DayPageProps {
  params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: DayPageProps): Promise<Metadata> {
  const { date } = await params;
  return { title: isValidISODate(date) ? date : "日頁" };
}

/** 某一天的那一頁（/days/2026-10-23） */
export default async function DayPage({ params }: DayPageProps) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <DayView date={date} />
    </ClientOnly>
  );
}
