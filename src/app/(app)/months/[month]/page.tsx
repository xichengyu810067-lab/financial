import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { isValidMonth, monthLabel } from "@/lib/ledger/entries";
import { MonthView } from "../month-view";

interface MonthPageProps {
  params: Promise<{ month: string }>;
}

export async function generateMetadata({ params }: MonthPageProps): Promise<Metadata> {
  const { month } = await params;
  return { title: isValidMonth(month) ? monthLabel(month) : "章節頁" };
}

/** 某個月的章節頁（/months/2026-10） */
export default async function MonthPage({ params }: MonthPageProps) {
  const { month } = await params;
  if (!isValidMonth(month)) notFound();
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <MonthView month={month} />
    </ClientOnly>
  );
}
