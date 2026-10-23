"use client";

import Link from "next/link";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { formatTWD } from "@/lib/ledger/format";
import { round2 } from "@/lib/ledger/report-model";

interface BudgetCardProps {
  /** 每月總支出上限 */
  limit: number;
  /** 本月至今支出 */
  spent: number;
  daysInMonth: number;
  dayOfMonth: number;
}

/** 今天這一頁的「這個月還能花」：剩餘、每天可花、進度條（黑色標記是今天應該在的進度） */
export function BudgetCard({ limit, spent, daysInMonth, dayOfMonth }: BudgetCardProps) {
  const remaining = round2(limit - spent);
  const daysLeft = daysInMonth - dayOfMonth;
  const perDay = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0;
  const ratio = limit > 0 ? spent / limit : 0;
  const over = remaining < 0;
  return (
    <Card size="sm" className={cn("border-t-[3px]", over ? "border-t-expense" : "border-t-foreground")}>
      <CardContent className="grid gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">這個月還能花</span>
          <Link href="/month" className="text-[11px] text-muted-foreground underline-offset-4 hover:underline">
            本月預算 →
          </Link>
        </div>
        <span className={cn("text-[26px] font-bold tabular-nums", over && "text-expense")}>{over ? `−${formatTWD(-remaining)}` : formatTWD(remaining)}</span>
        <span className="text-xs text-muted-foreground">
          {over ? `已超過總預算 ${formatTWD(limit)}` : daysLeft > 0 ? `每天可花 ${formatTWD(Math.floor(perDay))}，剩 ${daysLeft} 天` : `今天是月底，總預算 ${formatTWD(limit)}`}
        </span>
        <div aria-hidden className="relative h-2 overflow-hidden rounded-full bg-muted">
          <span className={cn("absolute inset-y-0 left-0 rounded-full", over ? "bg-expense" : "bg-foreground")} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
          <span className="absolute inset-y-[-2px] w-0.5 bg-foreground/60" style={{ left: `${Math.round((dayOfMonth / daysInMonth) * 100)}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}
