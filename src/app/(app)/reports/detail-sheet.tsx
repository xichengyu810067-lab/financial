"use client";

import { useMemo } from "react";
import { ArrowLeftRight, Flag } from "lucide-react";
import { cn } from "cn";
import { AccountIcon } from "@/components/account-icon";
import { useEntrySheet } from "@/components/entry/entry-sheet-provider";
import { Highlight } from "@/components/journal/highlight";
import { ReceiptList } from "@/components/journal/receipt-card";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { dayLabel, type Entry } from "@/lib/ledger/entries";
import { formatTWD } from "@/lib/ledger/format";
import { useEntriesInRange } from "@/lib/ledger/reports";
import type { Account } from "@/lib/ledger/types";
import { groupByDay } from "../transactions/entry-list";
import type { DetailRequest } from "./drill";

interface DetailSheetProps {
  request: DetailRequest | null;
  open: boolean;
  onClose: () => void;
  ledgerId: string;
  accounts: Account[];
}

/**
 * 下鑽明細面板：列出報表某一列背後、期間內的交易（依日期分組），點一筆就開記帳面板編輯。
 * 期間內的交易只抓一次，三張報表共用；篩選與底部合計由 request 決定。
 */
export function DetailSheet({ request, open, onClose, ledgerId, accounts }: DetailSheetProps) {
  const { openEdit, isOpen: editing } = useEntrySheet();
  const { data: entries, isPending, error } = useEntriesInRange(
    ledgerId,
    request?.period.from ?? "",
    request?.period.to ?? "",
    open && request !== null,
  );
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const matched = request && entries ? entries.filter(request.match) : [];
  const groups = groupByDay(matched);
  const summary = request && entries ? request.summarize(matched) : [];

  return (
    <Sheet
      open={open}
      onOpenChange={(next, details) => {
        if (next) return;
        // 記帳面板疊在上面時，點到它或按 Esc 不要連明細一起關掉
        if (editing && (details.reason === "outside-press" || details.reason === "escape-key" || details.reason === "focus-out")) {
          details.cancel();
          return;
        }
        onClose();
      }}
    >
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md" aria-describedby={undefined}>
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="font-hand text-[24px] font-bold">{request?.title ?? "明細"}</SheetTitle>
          <SheetDescription>{request?.subtitle ?? ""}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-6 pt-3 pb-4">
          {error ? (
            <p role="alert" className="rounded-xl border border-dashed border-expense/60 px-4 py-6 text-center text-sm text-expense">
              明細載入失敗：{error.message}
            </p>
          ) : isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : matched.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">
              這個期間沒有相關的交易。
            </p>
          ) : (
            <div className="grid gap-4">
              {groups.map((group, index) => (
                <section key={group.date} aria-label={dayLabel(group.date)}>
                  <Highlight tilt={index % 2 === 0 ? -1 : 1}>{dayLabel(group.date)}</Highlight>
                  <ReceiptList className="mt-2">
                    {group.entries.map((entry) => (
                      <DetailRow key={entry.id} entry={entry} accountsById={accountsById} onEdit={() => openEdit(entry)} />
                    ))}
                  </ReceiptList>
                </section>
              ))}
            </div>
          )}
        </div>

        {summary.length > 0 && (
          <SheetFooter className="gap-1 border-t border-dashed border-line px-6 py-4">
            {summary.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={cn("font-bold tabular-nums", item.tone === "income" && "text-income", item.tone === "expense" && "text-expense")}>
                  {formatTWD(item.value)}
                </span>
              </div>
            ))}
            <span className="pt-1 text-xs text-muted-foreground">共 {matched.length} 筆・點任一筆可編輯</span>
          </SheetFooter>
        )}
        <span aria-hidden className="receipt-edge shrink-0" />
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ entry, accountsById, onEdit }: { entry: Entry; accountsById: Map<string, Account>; onEdit: () => void }) {
  const category = entry.category_id ? accountsById.get(entry.category_id) : undefined;
  const parent = category?.parent_id ? accountsById.get(category.parent_id) : undefined;
  const from = entry.from_account_id ? accountsById.get(entry.from_account_id) : undefined;
  const to = entry.to_account_id ? accountsById.get(entry.to_account_id) : undefined;

  const title =
    entry.kind === "transfer"
      ? `${from?.name ?? "？"} → ${to?.name ?? "？"}`
      : entry.kind === "opening"
        ? `期初餘額・${to?.name ?? "？"}`
        : parent
          ? `${parent.name} › ${category?.name ?? ""}`
          : (category?.name ?? "未分類");
  const subtitle = [entry.kind === "expense" ? from?.name : entry.kind === "income" ? to?.name : null, entry.memo].filter(Boolean).join("・");

  const amount = Number(entry.amount);
  const amountText = entry.kind === "expense" ? `−${formatTWD(amount)}` : entry.kind === "income" ? `+${formatTWD(amount)}` : formatTWD(amount);
  const amountClass = entry.kind === "expense" ? "text-expense" : entry.kind === "income" ? "text-income" : "text-muted-foreground";
  // 期初餘額不是用記帳面板改的，要到帳戶頁
  const editable = entry.kind !== "opening";

  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={!editable}
      title={editable ? "編輯這筆交易" : "期初餘額請到帳戶頁修改"}
      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent"
    >
      {entry.kind === "transfer" || entry.kind === "opening" ? (
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {entry.kind === "transfer" ? <ArrowLeftRight className="size-4" /> : <Flag className="size-4" />}
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
