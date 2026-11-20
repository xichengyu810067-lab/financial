"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, FileUp, Inbox, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ImportInvoicesDialog } from "@/components/inbox/import-invoices-dialog";
import { InboxConfirmDialog } from "@/components/inbox/inbox-confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { throwIfFailed } from "@/lib/ledger/db";
import { dayLabel } from "@/lib/ledger/entries";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD } from "@/lib/ledger/format";
import { useConfirmInbox, useDismissInbox, usePendingInbox, useRecurringSync } from "@/lib/ledger/inbox";
import { SOURCE_LABELS, inboxTitle, isReady, payloadAsIs, type InboxItem, type InboxSource } from "@/lib/ledger/inbox-model";
import { useAccounts, useLedger } from "@/lib/ledger/queries";
import type { Account } from "@/lib/ledger/types";

/** 待確認匣：固定支出到期、掃描或匯入的發票先放這裡，確認後才入帳 */
export function InboxView() {
  const ledgerQuery = useLedger();
  const { data: ledger } = ledgerQuery;
  const ledgerId = ledger?.id;
  const accountsQuery = useAccounts(ledgerId);
  const { data: accounts } = accountsQuery;
  const itemsQuery = usePendingInbox(ledgerId);
  const { data: items } = itemsQuery;
  useRecurringSync(ledgerId);

  const confirm = useConfirmInbox();
  const dismiss = useDismissInbox();
  const [editing, setEditing] = useState<InboxItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batching, setBatching] = useState(false);
  const [importing, setImporting] = useState(false);

  const byId = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const groups = useMemo(() => {
    const map = new Map<string, InboxItem[]>();
    for (const item of items ?? []) map.set(item.entry_date, [...(map.get(item.entry_date) ?? []), item]);
    return [...map.entries()];
  }, [items]);
  const readyItems = (items ?? []).filter(isReady);
  const chosen = readyItems.filter((i) => selected.has(i.id));

  throwIfFailed(ledgerQuery, accountsQuery, itemsQuery);
  if (!ledger || !accounts || !items) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-[18px]" />
        <Skeleton className="h-24 w-full rounded-[18px]" />
      </div>
    );
  }

  const confirmOne = async (item: InboxItem) => {
    if (!isReady(item)) return setEditing(item);
    try {
      await confirm.mutateAsync({ ledgerId: ledger.id, itemId: item.id, payload: payloadAsIs(item) });
      toast.success(`已入帳「${inboxTitle(item)}」`);
    } catch (err) {
      toast.error(translateDbError(err));
    }
  };

  const confirmChosen = async () => {
    setBatching(true);
    let ok = 0;
    for (const item of chosen) {
      try {
        await confirm.mutateAsync({ ledgerId: ledger.id, itemId: item.id, payload: payloadAsIs(item) });
        ok += 1;
      } catch (err) {
        toast.error(`「${inboxTitle(item)}」沒有入帳：${translateDbError(err)}`);
      }
    }
    setBatching(false);
    setSelected(new Set());
    if (ok > 0) toast.success(`已入帳 ${ok} 筆`);
  };

  const dismissOne = (item: InboxItem) =>
    dismiss.mutate(
      { ledgerId: ledger.id, itemIds: [item.id] },
      { onSuccess: () => toast.success(`已略過「${inboxTitle(item)}」`), onError: (err) => toast.error(translateDbError(err)) },
    );

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <>
      <PageHeader
        title="待確認"
        description="固定支出到期、掃描或匯入的發票都先放這裡，確認後才記進帳本。"
        actions={
          <>
            <Link href="/scan" className={buttonVariants({ size: "sm" })}>
              <ScanLine className="size-4" aria-hidden />
              掃發票
            </Link>
            <Button size="sm" variant="outline" onClick={() => setImporting(true)}>
              <FileUp className="size-4" aria-hidden />
              匯入載具明細
            </Button>
            <Link href="/recurring" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <CalendarClock className="size-4" aria-hidden />
              固定支出
            </Link>
          </>
        }
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="grid justify-items-center gap-2 py-10 text-center">
            <Inbox className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-hand text-[17px]">沒有待確認的項目。</p>
            <p className="text-sm text-muted-foreground">
              到 <Link href="/recurring" className="font-bold text-primary underline-offset-4 hover:underline">固定支出</Link> 設定房租、訂閱，到期就會出現在這裡。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {readyItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 px-4 py-2.5 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={chosen.length === readyItems.length}
                  onCheckedChange={(on) => setSelected(on ? new Set(readyItems.map((i) => i.id)) : new Set())}
                  aria-label="選取全部可以直接確認的項目"
                />
                全選可直接確認的（{readyItems.length} 筆）
              </label>
              <Button size="sm" className="ml-auto" disabled={chosen.length === 0 || batching} onClick={() => void confirmChosen()}>
                {batching ? "入帳中…" : `確認選取的 ${chosen.length} 筆`}
              </Button>
            </div>
          )}

          {groups.map(([date, dayItems]) => (
            <section key={date} aria-label={dayLabel(date)} className="grid gap-2">
              <h2 className="text-sm font-bold text-muted-foreground">{dayLabel(date)}</h2>
              <ul className="grid gap-2">
                {dayItems.map((item) => (
                  <InboxRow
                    key={item.id}
                    item={item}
                    byId={byId}
                    checked={selected.has(item.id)}
                    onCheck={(on) => toggle(item.id, on)}
                    busy={confirm.isPending || dismiss.isPending || batching}
                    onConfirm={() => void confirmOne(item)}
                    onEdit={() => setEditing(item)}
                    onDismiss={() => dismissOne(item)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <InboxConfirmDialog item={editing} onClose={() => setEditing(null)} ledgerId={ledger.id} accounts={accounts} />
      <ImportInvoicesDialog open={importing} onOpenChange={setImporting} ledgerId={ledger.id} />
    </>
  );
}

interface InboxRowProps {
  item: InboxItem;
  byId: Map<string, Account>;
  checked: boolean;
  onCheck: (on: boolean) => void;
  busy: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}

function InboxRow({ item, byId, checked, onCheck, busy, onConfirm, onEdit, onDismiss }: InboxRowProps) {
  const title = inboxTitle(item);
  const ready = isReady(item);
  const name = (id: string | null) => (id ? (byId.get(id)?.name ?? "（已刪除）") : null);
  const account = item.kind === "income" ? name(item.to_account_id) : name(item.from_account_id);
  const target = item.kind === "transfer" ? name(item.to_account_id) : name(item.category_id);
  const sign = item.kind === "expense" ? "−" : item.kind === "income" ? "+" : "";

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[14px] bg-card px-4 py-3 ring-1 ring-border">
      <Checkbox checked={checked} disabled={!ready} onCheckedChange={(on) => onCheck(Boolean(on))} aria-label={`選取「${title}」`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold">{title}</span>
          <Badge variant="secondary">{SOURCE_LABELS[item.source as InboxSource]}</Badge>
        </div>
        <p className={cn("text-xs", ready ? "text-muted-foreground" : "text-expense")}>
          {ready ? `${account ?? "?"} → ${target ?? "?"}` : item.kind === "transfer" ? "還沒選帳戶" : !target ? "還沒選類別" : "還沒選帳戶"}
          {item.invoice_no && `・${item.invoice_no}`}
        </p>
      </div>
      <span className={cn("font-bold tabular-nums", item.kind === "expense" ? "text-expense" : item.kind === "income" ? "text-income" : "")}>
        {sign}
        {formatTWD(Number(item.amount))}
      </span>
      <div className="flex w-full justify-end gap-1.5 sm:w-auto">
        <Button size="sm" disabled={busy} onClick={onConfirm} aria-label={`確認「${title}」`}>
          {ready ? "確認" : "選類別…"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onEdit} aria-label={`修改「${title}」`}>
          修改
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDismiss} aria-label={`略過「${title}」`}>
          略過
        </Button>
      </div>
    </li>
  );
}
