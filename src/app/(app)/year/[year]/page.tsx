import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { YearView } from "../year-view";

interface YearPageProps {
  params: Promise<{ year: string }>;
}

const isYear = (value: string) => /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100;

export async function generateMetadata({ params }: YearPageProps): Promise<Metadata> {
  const { year } = await params;
  return { title: isYear(year) ? `${year} 年總覽` : "年度總覽" };
}

/** 某一年的封底（/year/2026） */
export default async function YearPage({ params }: YearPageProps) {
  const { year } = await params;
  if (!isYear(year)) notFound();
  return (
    <ClientOnly fallback={<Skeleton className="h-96 w-full" />}>
      <YearView year={Number(year)} />
    </ClientOnly>
  );
}
