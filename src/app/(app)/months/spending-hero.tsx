"use client";

import Link from "next/link";
import { cn } from "cn";
import { formatTWD } from "@/lib/ledger/format";
import { round2 } from "@/lib/ledger/report-model";

interface SpendingHeroProps {
  /** 每月總支出上限；null = 未設定 */
  limit: number | null;
  /** 本月支出合計 */
  spent: number;
  isCurrent: boolean;
  /** 剩幾天（過去的月份為 0） */
  daysLeft: number;
  /** 今天應該在的進度（0–1） */
  expected: number;
}

/**
 * 本月頁的主角：一個大數字「這個月還能花」，底下每天可花與剩幾天、進度列（黑色標記 = 今天應該在的進度）。
 * 沒設總上限時大字改成「本月已花」，並提示到設定頁填。
 */
export function SpendingHero({ limit, spent, isCurrent, daysLeft, expected }: SpendingHeroProps) {
  if (limit === null) {
    return (
      <section aria-label="本月已花" className="rounded-[18px] border-t-[3px] border-t-foreground bg-card p-6 shadow-paper ring-1 ring-border">
        <div className="text-sm text-muted-foreground">本月已花</div>
        <div className="mt-1 text-[44px] leading-none font-bold tabular-nums sm:text-[56px]">{formatTWD(spent)}</div>
        <p className="mt-4 text-sm text-muted-foreground">
          還沒設每月總支出上限，
          <Link href="/settings#spending-limit" className="mx-1 font-bold text-primary underline-offset-4 hover:underline">
            到設定頁填一個
          </Link>
          ，這裡就會變成「這個月還能花」。
        </p>
      </section>
    );
  }

  const remaining = round2(limit - spent);
  const over = remaining < 0;
  const perDay = daysLeft > 0 ? Math.floor(Math.max(0, remaining) / daysLeft) : null;
  const ratio = limit > 0 ? spent / limit : 0;

  const caption = over ? (
    <>
      已超過總預算 <strong className="tabular-nums">{formatTWD(limit)}</strong>
      {isCurrent && daysLeft > 0 && `，剩 ${daysLeft} 天先別再花`}
    </>
  ) : !isCurrent ? (
    "這一章已經結束，沒有超過總預算。"
  ) : perDay === null ? (
    "今天是月底。"
  ) : (
    <>
      每天可花 <strong className="tabular-nums">{formatTWD(perDay)}</strong>・剩 {daysLeft} 天
    </>
  );

  return (
    <section
      aria-label={isCurrent ? "這個月還能花" : "這個月剩下"}
      className={cn("rounded-[18px] border-t-[3px] bg-card p-6 shadow-paper ring-1 ring-border", over ? "border-t-expense" : "border-t-foreground")}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1 basis-72">
          <div className="text-sm text-muted-foreground">{isCurrent ? "這個月還能花" : "這個月剩下"}</div>
          <div className={cn("mt-1 text-[44px] leading-none font-bold tabular-nums sm:text-[56px]", over && "text-expense")}>
            {over ? `−${formatTWD(-remaining)}` : formatTWD(remaining)}
          </div>
          <p className="mt-3 text-[15px]">{caption}</p>
          <div aria-hidden className="relative mt-3.5 h-2.5 overflow-hidden rounded-full bg-muted">
            <span className={cn("absolute inset-y-0 left-0 rounded-full", over ? "bg-expense" : "bg-foreground")} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
            <span className="absolute inset-y-[-2px] w-0.5 bg-foreground/60" style={{ left: `${Math.round(expected * 100)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span>
              已花 {formatTWD(spent)} / 總預算 {formatTWD(limit)}
            </span>
            {isCurrent && <span>黑色標記：今天應該在的進度（{Math.round(expected * 100)}%）</span>}
          </div>
        </div>
        <Link href="/settings#spending-limit" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
          改總預算（設定頁）→
        </Link>
      </div>
    </section>
  );
}
