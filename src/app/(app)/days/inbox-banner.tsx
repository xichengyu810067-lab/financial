"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { usePendingInbox, useRecurringSync } from "@/lib/ledger/inbox";

/** 今天這一頁上方：有待確認項目時提醒（同時負責把到期的固定支出放進待確認匣） */
export function InboxBanner({ ledgerId }: { ledgerId: string }) {
  useRecurringSync(ledgerId);
  const { data: items } = usePendingInbox(ledgerId);
  const count = items?.length ?? 0;
  if (count === 0) return null;
  return (
    <Link
      href="/inbox"
      className="flex items-center gap-3 rounded-[14px] border border-dashed border-primary/60 bg-accent/40 px-4 py-3 text-sm transition-colors hover:bg-accent"
    >
      <Inbox className="size-5 text-primary" aria-hidden />
      <span className="flex-1">
        有 <strong className="tabular-nums">{count}</strong> 筆待確認（固定支出或發票），確認後才會記進帳本
      </span>
      <span className="font-bold text-primary">去確認 →</span>
    </Link>
  );
}
