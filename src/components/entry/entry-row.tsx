"use client";

import { ArrowLeftRight, Flag } from "lucide-react";
import { cn } from "cn";
import { AccountIcon } from "@/components/account-icon";
import type { Entry } from "@/lib/ledger/entries";
import { formatTWD } from "@/lib/ledger/format";
import type { Account } from "@/lib/ledger/types";

interface EntryRowProps {
  entry: Entry;
  accountsById: Map<string, Account>;
  onSelect?: () => void;
  className?: string;
}

/** 一列交易（圖示、標題、備註、金額）；整列是按鈕，點了開編輯。期初餘額不可點。 */
export function EntryRow({ entry, accountsById, onSelect, className }: EntryRowProps) {
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
  const editable = entry.kind !== "opening" && Boolean(onSelect);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!editable}
      title={editable ? "編輯這筆交易" : entry.kind === "opening" ? "期初餘額請到帳戶頁修改" : undefined}
      className={cn("flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent", className)}
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
