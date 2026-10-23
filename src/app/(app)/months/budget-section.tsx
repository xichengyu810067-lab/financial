"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { AccountIcon } from "@/components/account-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpsertMonthBudget } from "@/lib/ledger/budgets";
import type { BaselineRow } from "@/lib/ledger/chart-model";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD } from "@/lib/ledger/format";
import { round2 } from "@/lib/ledger/report-model";

interface BudgetSectionProps {
  ledgerId: string;
  /** YYYY-MM */
  month: string;
  isCurrent: boolean;
  rows: BaselineRow[];
  /** 今天應該在的進度（0–1） */
  expected: number;
  /** 每月總支出上限；null = 未設定 */
  limit: number | null;
  /** 本月支出合計 */
  spent: number;
  daysLeft: number;
  onSelect: (row: BaselineRow) => void;
}

const LEVEL = {
  over: { bar: "bg-expense", text: "text-expense", label: "已超過" },
  habit: { bar: "bg-warning", text: "text-warning", label: "習慣性超支" },
  ok: { bar: "bg-income", text: "text-foreground", label: "" },
  none: { bar: "bg-muted-foreground/60", text: "text-foreground", label: "" },
} as const;

/**
 * 本月預算：頂部一列總預算／已花／剩餘／每天可花，底下每個類別的進度列；
 * 點金額可以改「這個月」的額度（存 budgets 表），類別的基準線不動。
 */
export function BudgetSection({ ledgerId, month, isCurrent, rows, expected, limit, spent, daysLeft, onSelect }: BudgetSectionProps) {
  const upsert = useUpsertMonthBudget();
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const remaining = limit === null ? null : round2(limit - spent);
  const perDay = remaining !== null && daysLeft > 0 ? Math.max(0, remaining) / daysLeft : null;
  const ratio = limit !== null && limit > 0 ? spent / limit : null;

  const startEdit = (row: BaselineRow) => setEditing({ id: row.id, value: row.monthBudget === null ? "" : String(row.monthBudget) });

  const save = (row: BaselineRow) => {
    if (!editing) return;
    const raw = editing.value.trim();
    const amount = raw === "" ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      toast.error("請輸入 0 以上的金額");
      return;
    }
    upsert.mutate(
      { ledgerId, categoryId: row.id, month, amount },
      {
        onSuccess: () => {
          toast.success(amount === null ? "這個月回到類別基準線" : `這個月 ${row.name} 的額度設為 ${formatTWD(amount)}`);
          setEditing(null);
        },
        onError: (err) => toast.error(translateDbError(err)),
      },
    );
  };

  return (
    <div className="grid gap-4">
      {limit === null ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-muted-foreground">
          還沒設每月總支出上限，
          <Link href="/settings" className="mx-1 font-bold text-primary underline-offset-4 hover:underline">
            到設定頁填一個
          </Link>
          ，這裡會多顯示整月剩餘與每天可花。
        </p>
      ) : (
        <div className="grid gap-2 rounded-xl bg-muted/40 px-3 py-3">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <TotalStat label="總預算" value={formatTWD(limit)} />
            <TotalStat label="本月已花" value={formatTWD(spent)} tone={ratio !== null && ratio > 1 ? "expense" : undefined} />
            <TotalStat label="剩餘" value={formatTWD(remaining ?? 0)} tone={remaining !== null && remaining < 0 ? "expense" : "income"} />
            {isCurrent && <TotalStat label="每天可花" value={perDay === null ? "—" : formatTWD(Math.floor(perDay))} hint={`剩 ${daysLeft} 天`} />}
          </div>
          <div aria-hidden className="relative h-2 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("absolute inset-y-0 left-0 rounded-full", ratio !== null && ratio > 1 ? "bg-expense" : "bg-foreground")}
              style={{ width: `${ratio === null ? 0 : Math.min(100, Math.round(ratio * 100))}%` }}
            />
            <span className="absolute inset-y-[-2px] w-0.5 bg-foreground/60" style={{ left: `${Math.round(expected * 100)}%` }} />
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">
          還沒有費用類別的紀錄。到
          <Link href="/categories" className="mx-1 font-bold text-primary underline-offset-4 hover:underline">
            類別
          </Link>
          頁填基準線後這裡會長出進度。
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => {
            const style = LEVEL[row.level];
            const width = row.ratio === null ? 0 : Math.min(100, Math.round(row.ratio * 100));
            const isEditing = editing?.id === row.id;
            return (
              <li key={row.id} className="grid gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <button type="button" onClick={() => onSelect(row)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left hover:bg-muted/60" aria-label={`查看 ${row.name} 的交易`}>
                    <AccountIcon icon={row.icon} color={row.color} size="sm" />
                    <span className={cn("min-w-0 truncate font-bold", style.text)}>{row.name}</span>
                    {row.monthBudget !== null && (
                      <Badge variant="outline" className="shrink-0" title={row.categoryBudget === null ? "這個月另外設的額度" : `類別基準線 ${formatTWD(row.categoryBudget)}`}>
                        本月
                      </Badge>
                    )}
                    {style.label && <span className={cn("shrink-0 text-xs font-bold", style.text)}>{style.label}</span>}
                  </button>
                  {isEditing ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        save(row);
                      }}
                    >
                      <Input
                        value={editing.value}
                        onChange={(e) => setEditing({ id: row.id, value: e.target.value })}
                        inputMode="decimal"
                        placeholder={row.categoryBudget === null ? "這個月的額度" : `基準線 ${row.categoryBudget}`}
                        aria-label={`${row.name} 這個月的額度`}
                        autoFocus
                        className="h-8 w-32 text-sm"
                      />
                      <Button type="submit" size="icon-sm" variant="secondary" aria-label="儲存" disabled={upsert.isPending}>
                        <Check className="size-4" aria-hidden />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="取消" onClick={() => setEditing(null)}>
                        <X className="size-4" aria-hidden />
                      </Button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums hover:bg-muted/60 hover:text-foreground"
                      aria-label={`改 ${row.name} 這個月的額度`}
                      title="改這個月的額度"
                    >
                      {formatTWD(row.spent)}
                      {row.baseline !== null && (
                        <>
                          {" / "}
                          {formatTWD(row.baseline)}
                          {!row.usingBudget && <span>（三個月平均）</span>}
                        </>
                      )}
                      <Pencil className="size-3" aria-hidden />
                    </button>
                  )}
                </div>
                {row.baseline !== null && (
                  <div aria-hidden className="relative ml-9 h-2 overflow-hidden rounded-full bg-muted">
                    <span className={cn("absolute inset-y-0 left-0 rounded-full", style.bar)} style={{ width: `${width}%` }} />
                    <span className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: `${Math.round(expected * 100)}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TotalStat({ label, value, tone, hint }: { label: string; value: string; tone?: "income" | "expense"; hint?: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-bold tabular-nums", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
