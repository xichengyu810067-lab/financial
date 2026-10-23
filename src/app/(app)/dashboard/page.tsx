import { redirect } from "next/navigation";

/** 舊網址：儀表板改成「今天這一頁」 */
export default function DashboardPage() {
  redirect("/today");
}
