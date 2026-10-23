"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "cn";
import { EntryRow } from "@/components/entry/entry-row";
import { useEntrySheet } from "@/components/entry/entry-sheet-provider";
import { ReceiptList } from "@/components/journal/receipt-card";
import { Stamp } from "@/components/journal/stamp";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluateSpendingAlerts } from "@/lib/ledger/alerts";
import { compareChip, netWorthChange, type CompareChip } from "@/lib/ledger/day-model";
import { useCategoryStats, useDailySummary, type DailySummaryRow } from "@/lib/ledger/days";
import { dayLabel, monthRange } from "@/lib/ledger/entries";
import { formatTWD, todayISO } from "@/lib/ledger/format";
import { addDays, dayOfYear, daysInYear, weekdayShort } from "@/lib/ledger/period";
import { useAccounts, useLedger, useProfile } from "@/lib/ledger/queries";
import { buildBalanceSheet, round2 } from "@/lib/ledger/report-model";
import { useBalanceSheet, useEntriesInRange } from "@/lib/ledger/reports";
import { AlertsCard } from "./alerts-card";
import { DayCalendar } from "./day-calendar";

interface DayViewProps {
  /** 沒給就是今天（以瀏覽器的本地日期為準） */
  date?: string;
}

const EMPTY_DAY = (day: string): DailySummaryRow => ({ day, income: 0, expense: 0, entryCount: 0 });

/**
 * 一天一頁：翻開落在今天。今日收入／支出／結餘與昨天、上週同一天比，淨值、警示、當天交易。
 * 左右翻頁用連結（/days/YYYY-MM-DD），日曆彈窗跳日；不能翻到明天以後。
 */
export function DayView({ date: dateParam }: DayViewProps) {
  const router = useRouter();
  const today = todayISO();
  const date = dateParam ?? today;
  const isToday = date === today;
  const yesterday = addDays(date, -1);
  const lastWeek = addDays(date, -7);
  const month = date.slice(0, 7);
  const { start: monthStart, end: monthEnd } = monthRange(month);

  const { data: ledger } = useLedger();
  const ledgerId = ledger?.id;
  const { data: profile } = useProfile();
  const { data: accounts } = useAccounts(ledgerId);
  const { openNew, openEdit } = useEntrySheet();

  const entriesQuery = useEntriesInRange(ledgerId, date, date);
  const weekQuery = useDailySummary(ledgerId, lastWeek, date);
  const monthQuery = useDailySummary(ledgerId, monthStart, monthEnd);
  const statsQuery = useCategoryStats(ledgerId, date);
  const netNow = useBalanceSheet(ledgerId, date);
  const netYesterday = useBalanceSheet(ledgerId, yesterday);
  const netLastWeek = useBalanceSheet(ledgerId, lastWeek);

  if (date > today) {
    return (
      <div className="grid gap-4 py-10 text-center">
        <p className="font-hand text-[28px] font-bold">{dayLabel(date)} 還沒到。</p>
        <p className="text-sm text-muted-foreground">這一頁還是空白的，先回到今天吧。</p>
        <Link href="/today" className={cn(buttonVariants(), "mx-auto w-fit")}>
          回到今天
        </Link>
      </div>
    );
  }

  if (
    !ledger ||
    !profile ||
    !accounts ||
    !entriesQuery.data ||
    !weekQuery.data ||
    !monthQuery.data ||
    !statsQuery.data ||
    !netNow.data ||
    !netYesterday.data ||
    !netLastWeek.data
  ) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-16 w-72" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-[18px]" />
          <Skeleton className="h-28 rounded-[18px]" />
          <Skeleton className="h-28 rounded-[18px]" />
        </div>
        <Skeleton className="h-40 w-full rounded-[18px]" />
        <Skeleton className="h-48 w-full rounded-[18px]" />
      </div>
    );
  }

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const byDay = new Map(weekQuery.data.map((r) => [r.day, r]));
  const summaryOf = (d: string) => byDay.get(d) ?? EMPTY_DAY(d);
  const current = summaryOf(date);
  const prevDay = summaryOf(yesterday);
  const prevWeek = summaryOf(lastWeek);
  const netOf = (s: DailySummaryRow) => round2(s.income - s.expense);
  const netWorthOf = (rows: NonNullable<typeof netNow.data>) => buildBalanceSheet(rows, rows).netWorth.end;
  const netWorth = netWorthOf(netNow.data);
  const netWorthYesterday = netWorthOf(netYesterday.data);
  const netWorthLastWeek = netWorthOf(netLastWeek.data);
  const weekAgainst = `上${weekdayShort(date)}`;

  const entries = entriesQuery.data;
  const alerts = evaluateSpendingAlerts(statsQuery.data, entries, date);
  const mtd = monthQuery.data.filter((r) => r.day <= date);
  const mtdIncome = round2(mtd.reduce((s, r) => s + r.income, 0));
  const mtdExpense = round2(mtd.reduce((s, r) => s + r.expense, 0));

  const nextDate = addDays(date, 1);
  const nextHref = nextDate === today ? "/today" : `/days/${nextDate}`;
  const goTo = (d: string) => router.push(d === today ? "/today" : `/days/${d}`);

  return (
    <div className="grid gap-5">
      {isToday && (
        <span
          aria-hidden
          className="absolute top-7 -right-2.5 hidden h-8 w-16 items-center justify-center rounded-[6px_10px_10px_6px] bg-accent-gradient font-hand text-[15px] font-bold shadow-[0_3px_0_var(--accent-shadow)] md:flex"
        >
          今天
        </span>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/days/${yesterday}`} aria-label="翻到前一天" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <div>
            <div className="text-xs tracking-[0.18em] text-muted-foreground">
              {date.slice(0, 4)} 年・第 {dayOfYear(date)} 頁 / {daysInYear(date)}
            </div>
            <h1 className="mt-0.5 font-hand text-[34px] leading-tight font-bold sm:text-[40px]">{dayLabel(date)}</h1>
            <p className="mt-1 font-hand text-[16px] text-muted-foreground">
              {profile.slogan ?? (
                <Link href="/settings" className="underline-offset-4 hover:underline">
                  到設定頁寫一句自己的小標語
                </Link>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <Link href="/today" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              回到今天
            </Link>
          )}
          <DayCalendar key={date} ledgerId={ledger.id} date={date} today={today} onSelect={goTo} />
          {isToday ? (
            <span aria-label="明天還沒到" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "pointer-events-none opacity-40")}>
              <ChevronRight className="size-4" aria-hidden />
            </span>
          ) : (
            <Link href={nextHref} aria-label="翻到後一天" className={buttonVariants({ variant: "outline", size: "icon" })}>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </header>

      <section aria-label="今日收支" className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={isToday ? "今日收入" : "當天收入"}
          count={entries.filter((e) => e.kind === "income").length}
          value={current.income}
          display={`+${formatTWD(current.income)}`}
          tone="income"
          chips={[compareChip("income", current.income, prevDay.income, "昨天"), compareChip("income", current.income, prevWeek.income, weekAgainst)]}
        />
        <StatCard
          label={isToday ? "今日支出" : "當天支出"}
          count={entries.filter((e) => e.kind === "expense").length}
          value={current.expense}
          display={`−${formatTWD(current.expense)}`}
          tone="expense"
          chips={[compareChip("expense", current.expense, prevDay.expense, "昨天"), compareChip("expense", current.expense, prevWeek.expense, weekAgainst)]}
        />
        <StatCard
          label={isToday ? "今日結餘" : "當天結餘"}
          value={netOf(current)}
          display={formatTWD(netOf(current))}
          tone={netOf(current) < 0 ? "expense" : "ink"}
          chips={[compareChip("net", netOf(current), netOf(prevDay), "昨天"), compareChip("net", netOf(current), netOf(prevWeek), weekAgainst)]}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        <Card size="sm" className="border-t-[3px] border-t-primary lg:col-span-2">
          <Stamp className="absolute top-3 right-3">淨值</Stamp>
          <CardContent className="grid gap-1 pr-16">
            <span className="text-xs text-muted-foreground">{isToday ? "目前淨值" : "當天淨值"}</span>
            <span className="text-[28px] font-bold tabular-nums">{formatTWD(netWorth)}</span>
            <div className="flex flex-wrap gap-1.5">
              <Chip chip={netWorthChange(netWorth, netWorthYesterday)} prefix="比昨天" />
              <Chip chip={netWorthChange(netWorth, netWorthLastWeek)} prefix={`比${weekAgainst}`} />
            </div>
          </CardContent>
        </Card>
        <AlertsCard alerts={alerts} isToday={isToday} className="lg:col-span-3" />
      </section>

      <section aria-label="當天的交易" className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-bold">{isToday ? "今天的交易" : "這一天的交易"}</h2>
            <span className="text-xs text-muted-foreground">{entries.length} 筆・點一筆可編輯</span>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" aria-hidden />
            記一筆
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">
            {isToday ? "今天還沒記帳，按「記一筆」開始這一頁。" : "這一天沒有交易。"}
          </p>
        ) : (
          <ReceiptList>
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} accountsById={accountsById} onSelect={() => openEdit(entry)} />
            ))}
          </ReceiptList>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm text-muted-foreground">
        <span>
          本月至今　收入 <strong className="text-income tabular-nums">{formatTWD(mtdIncome)}</strong>　支出{" "}
          <strong className="text-expense tabular-nums">{formatTWD(mtdExpense)}</strong>　結餘{" "}
          <strong className={cn("tabular-nums", mtdIncome - mtdExpense < 0 ? "text-expense" : "text-foreground")}>{formatTWD(round2(mtdIncome - mtdExpense))}</strong>
        </span>
        <Link href="/month" className="font-bold text-primary underline-offset-4 hover:underline">
          翻到 {Number(month.slice(5, 7))} 月章節頁 →
        </Link>
      </footer>
    </div>
  );
}

const TONE_CLASS = { income: "border-t-income text-income", expense: "border-t-expense text-expense", ink: "border-t-foreground text-foreground" } as const;

function StatCard({
  label,
  count,
  display,
  tone,
  chips,
}: {
  label: string;
  count?: number;
  value: number;
  display: string;
  tone: keyof typeof TONE_CLASS;
  chips: CompareChip[];
}) {
  const [borderClass, textClass] = TONE_CLASS[tone].split(" ");
  return (
    <Card size="sm" className={cn("border-t-[3px]", borderClass)}>
      <CardContent className="grid gap-1">
        <span className="text-xs text-muted-foreground">
          {label}
          {count !== undefined && count > 0 && <span className="ml-1.5">{count} 筆</span>}
        </span>
        <span className={cn("text-[28px] font-bold tabular-nums", textClass)}>{display}</span>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Chip key={chip.text} chip={chip} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Chip({ chip, prefix }: { chip: CompareChip; prefix?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums",
        chip.tone === "good" && "bg-income/10 text-income",
        chip.tone === "bad" && "bg-expense/10 text-expense",
        chip.tone === "flat" && "bg-muted text-muted-foreground",
      )}
    >
      {prefix && <span>{prefix}</span>}
      {chip.text}
    </span>
  );
}
