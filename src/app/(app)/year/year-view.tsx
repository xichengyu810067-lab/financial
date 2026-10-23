"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { Stamp } from "@/components/journal/stamp";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { donutSlices, monthSeries, netWorthSeries } from "@/lib/ledger/chart-model";
import { useNetWorthByMonth } from "@/lib/ledger/charts";
import { currentMonth } from "@/lib/ledger/entries";
import { formatPercent, formatTWD, todayISO } from "@/lib/ledger/format";
import { dayOfYear, daysInYear, monthsInPeriod, yearPeriod } from "@/lib/ledger/period";
import { useAccounts, useLedger } from "@/lib/ledger/queries";
import { buildIncomeStatement, percentOf } from "@/lib/ledger/report-model";
import { useIncomeStatement, useMonthlySummary } from "@/lib/ledger/reports";
import { MonthlyBars } from "./monthly-bars";
import { NetWorthArea } from "./net-worth-area";

interface YearViewProps {
  /** 沒給就是今年 */
  year?: number;
}

/** 年度總覽（封底）：全年四個數字、每月收支、淨值走勢、今年的錢去了哪裡 */
export function YearView({ year: yearParam }: YearViewProps) {
  const router = useRouter();
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const year = yearParam ?? thisYear;
  const isCurrent = year === thisYear;
  const period = yearPeriod(year);
  const months = monthsInPeriod(period);
  const upTo = isCurrent ? currentMonth() : `${year}-12`;

  const { data: ledger } = useLedger();
  const ledgerId = ledger?.id;
  const { data: accounts } = useAccounts(ledgerId);
  const monthlyQuery = useMonthlySummary(ledgerId, period.from, period.to);
  const netWorthQuery = useNetWorthByMonth(ledgerId, period.from, period.to);
  const statementQuery = useIncomeStatement(ledgerId, period.from, period.to);

  if (year > thisYear) {
    return (
      <div className="grid gap-4 py-10 text-center">
        <p className="font-hand text-[28px] font-bold">{year} 年還沒到。</p>
        <Link href="/year" className={cn(buttonVariants(), "mx-auto w-fit")}>
          回到今年
        </Link>
      </div>
    );
  }

  if (!ledger || !accounts || !monthlyQuery.data || !netWorthQuery.data || !statementQuery.data) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-16 w-72" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-[18px]" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-[18px]" />
      </div>
    );
  }

  const points = monthSeries(monthlyQuery.data, months);
  const netWorthPoints = netWorthSeries(netWorthQuery.data, upTo);
  const statement = buildIncomeStatement(statementQuery.data, [], accounts);
  const income = statement.revenue.current;
  const expense = statement.expense.current;
  const net = statement.netCurrent;
  const savingRate = percentOf(net, income);
  const netWorthNow = netWorthPoints.length > 0 ? netWorthPoints[netWorthPoints.length - 1].netWorth : 0;
  const slices = donutSlices(statement.expense.lines);
  const pages = isCurrent ? dayOfYear(today) : daysInYear(period.from);

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.18em] text-muted-foreground">封底・年度總覽</div>
          <h1 className="mt-0.5 font-hand text-[34px] leading-tight font-bold sm:text-[40px]">{isCurrent ? `${year} 年，到目前為止` : `${year} 年`}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isCurrent ? `1 月 1 日到今天，共 ${pages} 頁。` : `整年 ${pages} 頁，這本已經寫完。`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/year/${year - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ‹ {year - 1} 年
          </Link>
          <Link href="/month" className={buttonVariants({ variant: "outline", size: "sm" })}>
            回到本月
          </Link>
          {isCurrent ? (
            <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-40")}>{year + 1} 年 ›</span>
          ) : (
            <Link href={year + 1 === thisYear ? "/year" : `/year/${year + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {year + 1} 年 ›
            </Link>
          )}
        </div>
      </header>

      <section aria-label="全年數字" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="今年收入" value={formatTWD(income)} tone="income" />
        <Stat label="今年支出" value={formatTWD(expense)} tone="expense" />
        <Stat label="今年存下" value={formatTWD(net)} tone={net < 0 ? "expense" : "ink"} hint={savingRate === null ? undefined : `存下收入的 ${formatPercent(savingRate)}`} />
        <Card size="sm" className="border-t-[3px] border-t-primary">
          <Stamp size="sm" className="absolute top-2 right-3">
            淨值
          </Stamp>
          <CardContent className="grid gap-0.5 pr-14">
            <span className="text-xs text-muted-foreground">{isCurrent ? "目前淨值" : "年底淨值"}</span>
            <span className="text-[24px] font-bold">{formatTWD(netWorthNow)}</span>
          </CardContent>
        </Card>
      </section>

      <Card size="sm">
        <CardHeader>
          <CardTitle>每個月的收入與支出</CardTitle>
          <CardDescription>一個月兩根，點一個月翻到那一章。</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBars points={points} onSelectMonth={(month) => router.push(month === currentMonth() ? "/month" : `/months/${month}`)} />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card size="sm" className="lg:col-span-3">
          <CardHeader>
            <CardTitle>淨值一路走來</CardTitle>
            <CardDescription>每個月底的資產減負債。</CardDescription>
          </CardHeader>
          <CardContent>
            <NetWorthArea points={netWorthPoints} />
          </CardContent>
        </Card>
        <Card size="sm" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>今年的錢去了哪裡</CardTitle>
            <CardDescription>費用類別占全年支出的比例。</CardDescription>
          </CardHeader>
          <CardContent>
            {slices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">今年還沒有支出。</p>
            ) : (
              <ul className="grid gap-3 text-sm">
                {slices.map((slice) => (
                  <li key={slice.id ?? "other"}>
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: slice.color }} />
                      <span className="min-w-0 flex-1 truncate font-bold">{slice.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatPercent(slice.percent)}・{formatTWD(slice.value)}
                      </span>
                    </div>
                    <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.round(slice.percent))}%`, backgroundColor: slice.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm text-muted-foreground">
        <Link href={`/reports?tab=income&preset=year&from=${period.from}&to=${period.to}`} className="underline-offset-4 hover:underline">
          想看正式的三張報表 →
        </Link>
        <Link href="/cover" className="font-bold text-primary underline-offset-4 hover:underline">
          闔上，回到封面 →
        </Link>
      </footer>
    </div>
  );
}

const STAT_TONE = {
  income: "border-t-income text-income",
  expense: "border-t-expense text-expense",
  ink: "border-t-foreground text-foreground",
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
