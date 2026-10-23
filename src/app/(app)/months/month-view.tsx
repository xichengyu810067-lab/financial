"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { monthContext } from "@/lib/ledger/alerts";
import { baselineRows, dailySeries, donutSlices, type BaselineRow, type DonutSlice } from "@/lib/ledger/chart-model";
import { useCategoryStats, useDailySummary } from "@/lib/ledger/days";
import { currentMonth, dayLabel, monthLabel, monthRange, shiftMonth } from "@/lib/ledger/entries";
import { formatPercent, formatTWD, todayISO } from "@/lib/ledger/format";
import { addDays } from "@/lib/ledger/period";
import { useAccounts, useLedger } from "@/lib/ledger/queries";
import { buildIncomeStatement, percentOf, round2 } from "@/lib/ledger/report-model";
import { useIncomeStatement } from "@/lib/ledger/reports";
import { DetailSheet } from "../reports/detail-sheet";
import { sumAmounts, type DetailRequest } from "../reports/drill";
import { BaselineProgress } from "./baseline-progress";
import { CategoryDonut } from "./category-donut";
import { DailyBars } from "./daily-bars";

interface MonthViewProps {
  /** YYYY-MM；沒給就是本月 */
  month?: string;
}

/**
 * 月章節頁：每個月的第一頁。本月累計、每日收支長條、支出類別環圈、離基準線還有多遠；
 * 點圖表從右側滑出明細面板。
 */
export function MonthView({ month: monthParam }: MonthViewProps) {
  const today = todayISO();
  const thisMonth = currentMonth();
  const month = monthParam ?? thisMonth;
  const isCurrent = month === thisMonth;
  const { start: monthStart, end: monthEnd } = monthRange(month);
  const asOf = isCurrent ? today : monthEnd;
  // 本月看「近 30 天到今天」，過去的月份看整個月
  const barsFrom = isCurrent ? addDays(today, -29) : monthStart;
  const barsTo = isCurrent ? today : monthEnd;

  const { data: ledger } = useLedger();
  const ledgerId = ledger?.id;
  const { data: accounts } = useAccounts(ledgerId);
  const statementQuery = useIncomeStatement(ledgerId, monthStart, monthEnd);
  const dailyQuery = useDailySummary(ledgerId, barsFrom, barsTo);
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

  if (!ledger || !accounts || !statementQuery.data || !dailyQuery.data || !statsQuery.data) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-16 w-72" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-[18px]" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-[18px]" />
        <Skeleton className="h-64 w-full rounded-[18px]" />
      </div>
    );
  }

  const statement = buildIncomeStatement(statementQuery.data, [], accounts);
  const income = statement.revenue.current;
  const expense = statement.expense.current;
  const net = statement.netCurrent;
  const savingRate = percentOf(net, income);
  const points = dailySeries(dailyQuery.data, barsFrom, barsTo);
  const slices = donutSlices(statement.expense.lines);
  const rows = baselineRows(statsQuery.data);
  const { daysInMonth, dayOfMonth } = monthContext(asOf);
  const expected = isCurrent ? dayOfMonth / daysInMonth : 1;
  const year = Number(month.slice(0, 4));
  const monthNo = Number(month.slice(5, 7));
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const open = (request: DetailRequest) => {
    setDetail(request);
    setDetailOpen(true);
  };

  const openDay = (day: string) =>
    open({
      title: dayLabel(day),
      subtitle: "這一天的交易",
      period: { preset: "custom", from: day, to: day },
      match: (entry) => entry.kind !== "opening",
      summarize: (entries) => {
        const inc = sumAmounts(entries.filter((e) => e.kind === "income"));
        const exp = sumAmounts(entries.filter((e) => e.kind === "expense"));
        return [
          { label: "收入", value: inc, tone: "income" },
          { label: "支出", value: exp, tone: "expense" },
          { label: "結餘", value: round2(inc - exp) },
        ];
      },
    });

  const openCategory = (name: string, memberIds: string[]) => {
    const ids = new Set(memberIds);
    open({
      title: name,
      subtitle: `${monthLabel(month)}的支出`,
      period: { preset: "month", from: monthStart, to: monthEnd },
      match: (entry) => entry.kind === "expense" && entry.category_id !== null && ids.has(entry.category_id),
      summarize: (entries) => [{ label: "支出合計", value: sumAmounts(entries), tone: "expense" }],
    });
  };
  const openSlice = (slice: DonutSlice) => openCategory(slice.name, slice.memberIds);
  const openRow = (row: BaselineRow) => openCategory(row.name, row.memberIds);

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.18em] text-muted-foreground">
            {year} 年・第 {monthNo} 章
          </div>
          <h1 className="mt-0.5 font-hand text-[34px] leading-tight font-bold sm:text-[40px]">{monthNo} 月的章節頁</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCurrent ? `到今天為止 ${dayOfMonth} 天，還剩 ${daysInMonth - dayOfMonth} 天。` : `整個月 ${daysInMonth} 天，這一章已經結束。`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/months/${prevMonth}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ‹ {Number(prevMonth.slice(5, 7))} 月
          </Link>
          <Link href={`/year/${year}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            年度總覽
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

      <section aria-label="本月累計" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="本月收入" value={formatTWD(income)} tone="income" />
        <Stat label="本月支出" value={formatTWD(expense)} tone="expense" />
        <Stat label="本月結餘" value={formatTWD(net)} tone={net < 0 ? "expense" : "ink"} />
        <Stat label="存下收入的" value={savingRate === null ? "—" : formatPercent(savingRate)} tone="accent" hint={savingRate === null ? "本月還沒有收入" : undefined} />
      </section>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{isCurrent ? "近 30 天每日收支" : "這個月每一天"}</CardTitle>
          <CardDescription>收入往上、支出往下，一天一根。</CardDescription>
        </CardHeader>
        <CardContent>
          <DailyBars points={points} highlightDay={isCurrent ? today : undefined} onSelectDay={openDay} />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>本月支出去了哪裡</CardTitle>
            <CardDescription>點一片看那個類別的交易。</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut slices={slices} total={expense} onSelect={openSlice} />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>離基準線還有多遠</CardTitle>
            <CardDescription>{isCurrent ? `黑色標記是今天應該在的進度（${Math.round(expected * 100)}%）。` : "整個月的結果。"}</CardDescription>
          </CardHeader>
          <CardContent>
            <BaselineProgress rows={rows} expected={expected} onSelect={openRow} />
          </CardContent>
        </Card>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm text-muted-foreground">
        <span>{isCurrent ? "這一章還沒結束，數字會隨每一筆更新。" : "想看那時候的每一天？用上方的日曆跳過去。"}</span>
        <Link href={`/year/${year}`} className="font-bold text-primary underline-offset-4 hover:underline">
          翻到封底看全年 →
        </Link>
      </footer>

      <DetailSheet request={detail} open={detailOpen} onClose={() => setDetailOpen(false)} ledgerId={ledger.id} accounts={accounts} />
    </div>
  );
}

const STAT_TONE = {
  income: "border-t-income text-income",
  expense: "border-t-expense text-expense",
  ink: "border-t-foreground text-foreground",
  accent: "border-t-primary text-primary",
} as const;

function Stat({ label, value, tone, hint }: { label: string; value: string; tone: keyof typeof STAT_TONE; hint?: string }) {
  const [border, text] = STAT_TONE[tone].split(" ");
  return (
    <Card size="sm" className={cn("border-t-[3px]", border)}>
      <CardContent className="grid gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-[24px] font-bold", text)}>{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}
