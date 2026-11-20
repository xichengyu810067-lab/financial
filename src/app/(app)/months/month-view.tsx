"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluateSpendingAlerts, monthContext } from "@/lib/ledger/alerts";
import { baselineRows, splitWatchRows, type WatchRow } from "@/lib/ledger/chart-model";
import { useCategoryStats } from "@/lib/ledger/days";
import { throwIfFailed } from "@/lib/ledger/db";
import { currentMonth, monthLabel, monthRange, shiftMonth } from "@/lib/ledger/entries";
import { todayISO } from "@/lib/ledger/format";
import { useAccounts, useLedger } from "@/lib/ledger/queries";
import { buildIncomeStatement } from "@/lib/ledger/report-model";
import { useIncomeStatement } from "@/lib/ledger/reports";
import { DetailSheet } from "../reports/detail-sheet";
import { sumAmounts, type DetailRequest } from "../reports/drill";
import { CategoryWatch } from "./category-watch";
import { SpendingHero } from "./spending-hero";

interface MonthViewProps {
  /** YYYY-MM；沒給就是本月 */
  month?: string;
}

/**
 * 月章節頁：第一眼是「這個月還能花」的大數字，底下只展開要注意的類別，其餘收合。
 * 收支明細與圖表都在報表頁；點類別名稱從右側滑出明細面板。
 */
export function MonthView({ month: monthParam }: MonthViewProps) {
  const today = todayISO();
  const thisMonth = currentMonth();
  const month = monthParam ?? thisMonth;
  const isCurrent = month === thisMonth;
  const { start: monthStart, end: monthEnd } = monthRange(month);
  const asOf = isCurrent ? today : monthEnd;

  const ledgerQuery = useLedger();
  const { data: ledger } = ledgerQuery;
  const ledgerId = ledger?.id;
  const accountsQuery = useAccounts(ledgerId);
  const { data: accounts } = accountsQuery;
  const statementQuery = useIncomeStatement(ledgerId, monthStart, monthEnd);
  const statsQuery = useCategoryStats(ledgerId, asOf);

  const [detail, setDetail] = useState<DetailRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  if (month > thisMonth) {
    return (
      <div className="grid gap-4 py-10 text-center">
        <p className="font-hand text-[28px] font-bold">{monthLabel(month)}還沒到。</p>
        <Link href="/month" className={cn(buttonVariants(), "mx-auto w-fit")}>
          回到本月
        </Link>
      </div>
    );
  }

  throwIfFailed(ledgerQuery, accountsQuery, statementQuery, statsQuery);
  if (!ledger || !accounts || !statementQuery.data || !statsQuery.data) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-52 w-full rounded-[18px]" />
        <Skeleton className="h-64 w-full rounded-[18px]" />
      </div>
    );
  }

  const statement = buildIncomeStatement(statementQuery.data, [], accounts);
  const expense = statement.expense.current;
  const alerts = evaluateSpendingAlerts(statsQuery.data, [], asOf);
  const { attention, calm } = splitWatchRows(baselineRows(statsQuery.data), alerts);
  const { daysInMonth, dayOfMonth } = monthContext(asOf);
  const daysLeft = isCurrent ? daysInMonth - dayOfMonth : 0;
  const expected = isCurrent ? dayOfMonth / daysInMonth : 1;
  const year = Number(month.slice(0, 4));
  const monthNo = Number(month.slice(5, 7));
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const reportHref = `/reports?tab=income&preset=month&from=${monthStart}&to=${monthEnd}`;

  const openRow = (row: WatchRow) => {
    const ids = new Set(row.memberIds);
    setDetail({
      title: row.name,
      subtitle: `${monthLabel(month)}的支出`,
      period: { preset: "month", from: monthStart, to: monthEnd },
      match: (entry) => entry.kind === "expense" && entry.category_id !== null && ids.has(entry.category_id),
      summarize: (entries) => [{ label: "支出合計", value: sumAmounts(entries), tone: "expense" }],
    });
    setDetailOpen(true);
  };

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.18em] text-muted-foreground">
            {year} 年・第 {monthNo} 章
          </div>
          <h1 className="mt-0.5 font-hand text-[34px] leading-tight font-bold sm:text-[40px]">{monthNo} 月</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCurrent ? `到今天為止 ${dayOfMonth} 天，還剩 ${daysLeft} 天。` : `整個月 ${daysInMonth} 天，這一章已經結束。`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/months/${prevMonth}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ‹ {Number(prevMonth.slice(5, 7))} 月
          </Link>
          {isCurrent ? (
            <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-40")}>{Number(nextMonth.slice(5, 7))} 月 ›</span>
          ) : (
            <Link href={nextMonth === thisMonth ? "/month" : `/months/${nextMonth}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {Number(nextMonth.slice(5, 7))} 月 ›
            </Link>
          )}
        </div>
      </header>

      <SpendingHero limit={ledger.monthly_spending_limit} spent={expense} isCurrent={isCurrent} daysLeft={daysLeft} expected={expected} />

      <CategoryWatch ledgerId={ledger.id} month={month} isCurrent={isCurrent} attention={attention} calm={calm} expected={expected} daysLeft={daysLeft} onSelect={openRow} />

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm text-muted-foreground">
        <span>{isCurrent ? "這一章還沒結束，數字會隨每一筆更新。收支明細與圖表在報表頁。" : "收支明細與圖表在報表頁。"}</span>
        <Link href={reportHref} className="font-bold text-primary underline-offset-4 hover:underline">
          看 {monthNo} 月的報表 →
        </Link>
      </footer>

      <DetailSheet request={detail} open={detailOpen} onClose={() => setDetailOpen(false)} ledgerId={ledger.id} accounts={accounts} />
    </div>
  );
}
