"use client";

import { ArrowLeftRight, Copy, EllipsisVertical, Pencil, Trash } from "lucide-react";
import { cn } from "cn";
import { AccountIcon } from "@/components/account-icon";
import { ReceiptList } from "@/components/journal/receipt-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dayLabel, type Entry } from "@/lib/ledger/entries";
import { formatTWD } from "@/lib/ledger/format";
import type { Account } from "@/lib/ledger/types";

export interface DayGroup {
  date: string;
  entries: Entry[];
  income: number;
  expense: number;
}

/** 依日期分組（輸入已是日期降冪） */
export function groupByDay(entries: Entry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== entry.entry_date) {
      group = { date: entry.entry_date, entries: [], income: 0, expense: 0 };
      groups.push(group);
    }
    group.entries.push(entry);
    if (entry.kind === "income") group.income += Number(entry.amount);
    if (entry.kind === "expense") group.expense += Number(entry.amount);
  }
  return groups;
}

interface EntryListProps {
  groups: DayGroup[];
  accountsById: Map<string, Account>;
  selectMode: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (entry: Entry) => void;
  onCopy: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
}

/** 每一天一張卡：手寫日期、虛線分隔的交易列 */
export function EntryList({ groups, accountsById, selectMode, selected, onToggle, onEdit, onCopy, onDelete }: EntryListProps) {
  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <Card key={group.date} size="sm" aria-label={dayLabel(group.date)}>
          <CardContent className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-hand text-[15px] font-bold">{dayLabel(group.date)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {group.expense > 0 && <span>支出 {formatTWD(group.expense)}</span>}
                {group.expense > 0 && group.income > 0 && <span className="mx-1">・</span>}
                {group.income > 0 && <span>收入 {formatTWD(group.income)}</span>}
              </span>
            </div>
            <ReceiptList>
              {group.entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  accountsById={accountsById}
                  selectMode={selectMode}
                  selected={selected.has(entry.id)}
                  onToggle={() => onToggle(entry.id)}
                  onEdit={() => onEdit(entry)}
                  onCopy={() => onCopy(entry)}
                  onDelete={() => onDelete(entry)}
                />
              ))}
            </ReceiptList>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface EntryRowProps {
  entry: Entry;
  accountsById: Map<string, Account>;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

function EntryRow({ entry, accountsById, selectMode, selected, onToggle, onEdit, onCopy, onDelete }: EntryRowProps) {
  const category = entry.category_id ? accountsById.get(entry.category_id) : undefined;
  const parent = category?.parent_id ? accountsById.get(category.parent_id) : undefined;
  const from = entry.from_account_id ? accountsById.get(entry.from_account_id) : undefined;
  const to = entry.to_account_id ? accountsById.get(entry.to_account_id) : undefined;

  const title =
    entry.kind === "transfer"
      ? `${from?.name ?? "？"} → ${to?.name ?? "？"}`
      : parent
        ? `${parent.name} › ${category?.name ?? ""}`
        : (category?.name ?? "未分類");
  const subtitle = [entry.kind === "expense" ? from?.name : entry.kind === "income" ? to?.name : null, entry.memo]
    .filter(Boolean)
    .join("・");

  const amount = Number(entry.amount);
  const amountText = entry.kind === "expense" ? `−${formatTWD(amount)}` : entry.kind === "income" ? `+${formatTWD(amount)}` : formatTWD(amount);
  const amountClass = entry.kind === "expense" ? "text-expense" : entry.kind === "income" ? "text-income" : "text-muted-foreground";

  return (
    <div className={cn("flex items-center gap-3 py-2.5", selected && "bg-accent/60")}>
      {selectMode && <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`選取 ${title}`} />}
      <button
        type="button"
        onClick={selectMode ? onToggle : onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
        aria-label={`${title} ${amountText}`}
      >
        {entry.kind === "transfer" ? (
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
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
      {!selectMode && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="更多操作" />}>
            <EllipsisVertical className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" aria-hidden />
              編輯
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="size-4" aria-hidden />
              複製
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash className="size-4" aria-hidden />
              刪除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
