"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { throwIfFailed } from "@/lib/ledger/db";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD, todayISO } from "@/lib/ledger/format";
import { useDeleteRecurringRule, useRecurringRules, useSaveRecurringRule, type RecurringRule } from "@/lib/ledger/inbox";
import { useAccounts, useLedger } from "@/lib/ledger/queries";
import { describeSchedule, recurrenceOnOrAfter, type Frequency } from "@/lib/ledger/recurrence";
import { RecurringDialog } from "./recurring-dialog";

const KIND_LABELS = { expense: "支出", income: "收入", transfer: "轉帳" } as const;

/** 固定支出（也可以是固定收入、固定轉帳）：到期時放進待確認匣 */
export function RecurringView() {
  const ledgerQuery = useLedger();
  const { data: ledger } = ledgerQuery;
  const accountsQuery = useAccounts(ledger?.id);
  const { data: accounts } = accountsQuery;
  const rulesQuery = useRecurringRules(ledger?.id);
  const { data: rules } = rulesQuery;
  const save = useSaveRecurringRule();
  const remove = useDeleteRecurringRule();
  const [editing, setEditing] = useState<RecurringRule | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<RecurringRule | null>(null);
  const nameOf = useMemo(() => {
    const map = new Map((accounts ?? []).map((a) => [a.id, a.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "（已刪除）") : "?");
  }, [accounts]);

  throwIfFailed(ledgerQuery, accountsQuery, rulesQuery);
  if (!ledger || !accounts || !rules) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-[18px]" />
      </div>
    );
  }

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  // 恢復時從今天起算下次日期，不補暫停期間的期數
  const toggleActive = (rule: RecurringRule) =>
    save.mutate(
      {
        ...rule,
        is_active: !rule.is_active,
        next_date: rule.is_active
          ? rule.next_date
          : recurrenceOnOrAfter(
              { frequency: rule.frequency as Frequency, dayOfMonth: rule.day_of_month, weekday: rule.weekday, monthOfYear: rule.month_of_year },
              todayISO(),
            ),
      },
      {
        onSuccess: () => toast.success(rule.is_active ? `已暫停「${rule.name}」` : `已恢復「${rule.name}」`),
        onError: (err) => toast.error(translateDbError(err)),
      },
    );

  return (
    <>
      <PageHeader
        title="固定支出"
        description="房租、訂閱、保險這類每期都有的帳。到期當天會放進待確認匣，點一下就入帳。"
        actions={
          <>
            <Link href="/inbox" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              待確認匣 →
            </Link>
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4" aria-hidden />
              新增固定支出
            </Button>
          </>
        }
      />

      {rules.length === 0 ? (
        <Card>
          <CardContent className="grid justify-items-center gap-2 py-10 text-center">
            <CalendarClock className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-hand text-[17px]">還沒有固定支出。</p>
            <p className="text-sm text-muted-foreground">房租、手機費、Netflix 設一次，之後每期自動提醒。</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {rules.map((rule) => {
            const route =
              rule.kind === "transfer"
                ? `${nameOf(rule.from_account_id)} → ${nameOf(rule.to_account_id)}`
                : rule.kind === "income"
                  ? `${nameOf(rule.category_id)} → ${nameOf(rule.to_account_id)}`
                  : `${nameOf(rule.from_account_id)} → ${nameOf(rule.category_id)}`;
            return (
              <li key={rule.id} className={cn("flex flex-wrap items-center gap-3 rounded-[14px] bg-card px-4 py-3 ring-1 ring-border", !rule.is_active && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{rule.name}</span>
                    <Badge variant="secondary">{KIND_LABELS[rule.kind as keyof typeof KIND_LABELS]}</Badge>
                    {!rule.is_active && <Badge variant="outline">已暫停</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {describeSchedule({
                      frequency: rule.frequency as Frequency,
                      dayOfMonth: rule.day_of_month,
                      weekday: rule.weekday,
                      monthOfYear: rule.month_of_year,
                    })}
                    ・{route}
                    {rule.is_active && `・下次 ${rule.next_date}`}
                  </p>
                </div>
                <span className="font-bold tabular-nums">
                  {formatTWD(rule.amount)}
                  {rule.amount_varies && <span className="ml-1 text-xs font-normal text-muted-foreground">起</span>}
                </span>
                <div className="flex w-full justify-end gap-1 sm:w-auto">
                  <Button size="sm" variant="ghost" aria-label={`編輯「${rule.name}」`} onClick={() => {
                      setEditing(rule);
                      setDialogOpen(true);
                    }}>
                    <Pencil className="size-4" aria-hidden />
                    編輯
                  </Button>
                  <Button size="sm" variant="ghost" disabled={save.isPending} aria-label={`${rule.is_active ? "暫停" : "恢復"}「${rule.name}」`} onClick={() => toggleActive(rule)}>
                    {rule.is_active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                    {rule.is_active ? "暫停" : "恢復"}
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`刪除「${rule.name}」`} onClick={() => setDeleting(rule)}>
                    <Trash2 className="size-4" aria-hidden />
                    刪除
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RecurringDialog open={dialogOpen} onOpenChange={setDialogOpen} ledgerId={ledger.id} accounts={accounts} rule={editing} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`刪除「${deleting?.name ?? ""}」？`}
        description="還沒確認的待確認項目會一起刪掉；已經入帳的交易不受影響。"
        confirmLabel="刪除"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { ledgerId: ledger.id, id: deleting.id },
            {
              onSuccess: () => {
                toast.success(`已刪除「${deleting.name}」`);
                setDeleting(null);
              },
              onError: (err) => toast.error(translateDbError(err)),
            },
          )
        }
      />
    </>
  );
}
