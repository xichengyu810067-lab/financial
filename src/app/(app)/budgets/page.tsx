import { redirect } from "next/navigation";

/** 舊網址：預算併進了「本月」這一頁 */
export default function BudgetsPage() {
  redirect("/month");
}
