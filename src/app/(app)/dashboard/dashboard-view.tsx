"use client";

import Link from "next/link";
import { ArrowLeftRight, FileText, Tags, Wallet } from "lucide-react";
import { cn } from "cn";
import { AccountIcon } from "@/components/account-icon";
import { useEntrySheet } from "@/components/entry/entry-sheet-provider";
import { DoodleUnderline } from "@/components/journal/doodle-underline";
import { Highlight } from "@/components/journal/highlight";
import { ReceiptCard, ReceiptList } from "@/components/journal/receipt-card";
import { Stamp } from "@/components/journal/stamp";
import { StickyNote } from "@/components/journal/sticky-note";
import { WashiTape } from "@/components/journal/washi-tape";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayLabel, greetingForHour } from "@/lib/greeting";
import { currentMonth, dayLabel, monthLabel, useEntries, type Entry } from "@/lib/ledger/entries";
import { formatTWD } from "@/lib/ledger/format";
import { useAccounts, useBalances, useLedger, useProfile } from "@/lib/ledger/queries";
import { isBalanceAccount, type Account } from "@/lib/ledger/types";

export function DashboardView() {
  const { data: profile } = useProfile();
  const { data: ledger } = useLedger();
  const ledgerId = ledger?.id;
  const { data: accounts } = useAccounts(ledgerId);
  const { data: balances } = useBalances(ledgerId);
  const month = currentMonth();
  const { data: entries } = useEntries(ledgerId, month);
  const { openEdit } = useEntrySheet();

  if (!profile || !ledger || !accounts || !balances || !entries) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-28 w-full rounded-[22px]" />
        <Skeleton className="h-64 w-full rounded-[22px]" />
      </div>
    );
  }

  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const name = profile.display_name ?? "你";
  const income = entries.filter((e) => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expense = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const balanceOf = (id: string) => Number(balances.get(id)?.balance ?? 0);
  const assets = accounts.filter((a) => a.type === "asset" && !a.is_system).reduce((s, a) => s + balanceOf(a.id), 0);
  const liabilities = accounts.filter((a) => a.type === "liability" && !a.is_system).reduce((s, a) => s + balanceOf(a.id), 0);
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const recent = entries.slice(0, 5);
  const hasAccounts = accounts.some((a) => isBalanceAccount(a) && !a.is_system);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-hand text-[34px] font-bold leading-tight">
            {greeting}，{name}
          </h1>
          <p className="mt-1 inline-flex flex-col font-hand text-base text-muted-foreground">
            {profile.slogan ? (
              <span>{profile.slogan}</span>
            ) : (
              <Link href="/settings" className="underline-offset-4 hover:underline">
                到設定頁寫一句自己的小標語
              </Link>
            )}
            <DoodleUnderline />
          </p>
        </div>
        <StickyNote>{formatDayLabel(now)}</StickyNote>
      </header>

      <section aria-label="本月摘要" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <WashiTape tone="accent" />
          <CardContent className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">本月收入</span>
            <span className="text-[26px] font-bold text-income tabular-nums">{formatTWD(income)}</span>
            <span className="text-xs text-muted-foreground">{monthLabel(month)}</span>
          </CardContent>
        </Card>
        <Card size="sm">
          <WashiTape tone="mint" />
          <CardContent className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">本月支出</span>
            <span className="text-[26px] font-bold text-expense tabular-nums">{formatTWD(expense)}</span>
            <span className="text-xs text-muted-foreground">{entries.filter((e) => e.kind === "expense").length} 筆</span>
          </CardContent>
        </Card>
        <Card size="sm">
          <WashiTape tone="sun" />
          <CardContent className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">本月結餘</span>
            <span className={cn("text-[26px] font-bold tabular-nums", income - expense < 0 && "text-expense")}>{formatTWD(income - expense)}</span>
            <span className="text-xs text-muted-foreground">{income > 0 ? `存下收入的 ${Math.round(((income - expense) / income) * 100)}%` : "本月還沒有收入"}</span>
          </CardContent>
        </Card>
        <Card size="sm">
          <Stamp className="absolute top-3 right-3">淨值</Stamp>
          <CardContent className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">目前淨值</span>
            <span className="text-[26px] font-bold tabular-nums">{formatTWD(assets - liabilities)}</span>
            <span className="text-xs text-muted-foreground">
              資產 {formatTWD(assets)}・負債 {formatTWD(liabilities)}
            </span>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <ReceiptCard className="lg:col-span-3" notchBottom={40}>
          <CardHeader className="flex flex-row items-baseline justify-between">
            <CardTitle>最近交易</CardTitle>
            <Link href="/transactions" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
              全部交易 →
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recent.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">
                這個月還沒有交易，按右下角的「記一筆」開始吧。
              </p>
            ) : (
              <>
                <Highlight>{dayLabel(recent[0].entry_date)}</Highlight>
                <ReceiptList>
                  {recent.map((entry) => (
                    <RecentRow key={entry.id} entry={entry} accountsById={accountsById} onClick={() => openEdit(entry)} />
                  ))}
                </ReceiptList>
              </>
            )}
          </CardContent>
        </ReceiptCard>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>接下來</CardTitle>
              <Badge variant="highlight">里程碑 4</Badge>
            </div>
            <CardDescription>收支趨勢與類別占比圖會在下一個里程碑加到這裡。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {!hasAccounts && (
              <Link href="/accounts" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Wallet className="size-4" aria-hidden />
                先建立帳戶
              </Link>
            )}
            <Link href="/reports" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <FileText className="size-4" aria-hidden />
              三大報表
            </Link>
            <Link href="/accounts" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Wallet className="size-4" aria-hidden />
              帳戶與期初餘額
            </Link>
            <Link href="/categories" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Tags className="size-4" aria-hidden />
              整理類別
            </Link>
            <Link href="/transactions" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <ArrowLeftRight className="size-4" aria-hidden />
              交易清單
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function RecentRow({ entry, accountsById, onClick }: { entry: Entry; accountsById: Map<string, Account>; onClick: () => void }) {
  const category = entry.category_id ? accountsById.get(entry.category_id) : undefined;
  const from = entry.from_account_id ? accountsById.get(entry.from_account_id) : undefined;
  const to = entry.to_account_id ? accountsById.get(entry.to_account_id) : undefined;
  const title = entry.kind === "transfer" ? `${from?.name ?? "？"} → ${to?.name ?? "？"}` : (category?.name ?? "未分類");
  const subtitle = [entry.kind === "expense" ? from?.name : entry.kind === "income" ? to?.name : null, entry.memo].filter(Boolean).join("・");
  const amount = Number(entry.amount);
  const amountText = entry.kind === "expense" ? `−${formatTWD(amount)}` : entry.kind === "income" ? `+${formatTWD(amount)}` : formatTWD(amount);
  const amountClass = entry.kind === "expense" ? "text-expense" : entry.kind === "income" ? "text-income" : "text-muted-foreground";

  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 py-2.5 text-left hover:bg-muted/40">
      {entry.kind === "transfer" ? (
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ArrowLeftRight className="size-4" />
        </span>
      ) : (
        <AccountIcon icon={category?.icon} color={category?.color} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <span className={cn("shrink-0 text-sm font-bold tabular-nums", amountClass)}>{amountText}</span>
    </button>
  );
}
