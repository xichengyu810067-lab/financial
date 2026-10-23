"use client";

import Link from "next/link";
import { cn } from "cn";
import { AccountIcon } from "@/components/account-icon";
import type { BaselineRow } from "@/lib/ledger/chart-model";
import { formatTWD } from "@/lib/ledger/format";

interface BaselineProgressProps {
  rows: BaselineRow[];
  /** 今天應該在的進度（0–1）；看過去的月份時為 1 */
  expected: number;
  onSelect: (row: BaselineRow) => void;
}

const LEVEL = {
  over: { bar: "bg-expense", text: "text-expense", label: "已超過" },
  habit: { bar: "bg-warning", text: "text-warning", label: "習慣性超支" },
  ok: { bar: "bg-income", text: "text-foreground", label: "" },
  none: { bar: "bg-muted-foreground/60", text: "text-foreground", label: "沒有基準線" },
} as const;

/** 每個頂層費用類別離基準線還有多遠；灰色標記是今天應該在的進度 */
export function BaselineProgress({ rows, expected, onSelect }: BaselineProgressProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">
        還沒有費用類別的紀錄。到
        <Link href="/categories" className="mx-1 font-bold text-primary underline-offset-4 hover:underline">
          類別
        </Link>
        頁填基準線後這裡會長出進度。
      </p>
    );
  }
  return (
    <ul className="grid gap-3">
      {rows.map((row) => {
        const style = LEVEL[row.level];
        const width = row.ratio === null ? 0 : Math.min(100, Math.round(row.ratio * 100));
        return (
          <li key={row.id}>
            <button type="button" onClick={() => onSelect(row)} className="w-full rounded-lg px-1 py-0.5 text-left hover:bg-muted/60" aria-label={`查看 ${row.name} 的交易`}>
              <div className="flex items-center gap-2 text-sm">
                <AccountIcon icon={row.icon} color={row.color} size="sm" />
                <span className={cn("min-w-0 flex-1 truncate font-bold", style.text)}>{row.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTWD(row.spent)}
                  {row.baseline !== null && (
                    <>
                      {" / "}
                      {formatTWD(row.baseline)}
                      {!row.usingBudget && <span className="ml-1">（三個月平均）</span>}
                    </>
                  )}
                  {style.label && <span className={cn("ml-2 font-bold", style.text)}>{style.label}</span>}
                </span>
              </div>
              {row.baseline !== null && (
                <div aria-hidden className="relative mt-1.5 ml-9 h-2 overflow-hidden rounded-full bg-muted">
                  <span className={cn("absolute inset-y-0 left-0 rounded-full", style.bar)} style={{ width: `${width}%` }} />
                  <span className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: `${Math.round(expected * 100)}%` }} />
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
