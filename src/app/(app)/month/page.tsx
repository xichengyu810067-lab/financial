import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "本月" };

export default function MonthPage() {
  return <PlaceholderPage title="本月章節頁" milestone={4} description="每個月的第一頁：近 30 天每日收支、支出類別環圈、離基準線還有多遠。" />;
}
