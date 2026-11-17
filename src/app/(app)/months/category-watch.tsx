"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { AccountIcon } from "@/components/account-icon";
import { Stamp } from "@/components/journal/stamp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpsertMonthBudget } from "@/lib/ledger/budgets";
import { watchReason, type WatchReason, type WatchRow } from "@/lib/ledger/chart-model";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD } from "@/lib/ledger/format";
import { round2 } from "@/lib/ledger/report-model";

interface CategoryWatchProps {
  ledgerId: string;
  /** YYYY-MM */
  month: string;
  isCurrent: boolean;
  /** 要注意的類別（已超過、照速度會超過、習慣性超支） */
  attention: WatchRow[];
  /** 在範圍內的類別，預設收合 */
  calm: WatchRow[];
  /** 今天應該在的進度（0–1） */
  expected: number;
  daysLeft: number;
  onSelect: (row: WatchRow) => void;
}

const REASON_STYLE: Record<WatchReason, { bar: string; badge: string }> = {
  over: { bar: "bg-expense", badge: "bg-expense/10 text-expense" },
  pace: { bar: "bg-warning", badge: "bg-warning/10 text-warning" },
  habit: { bar: "bg-warning", badge: "bg-warning/10 text-warning" },
};

function badgeText(row: WatchRow, reason: WatchReason): string {
  if (reason === "over") return `已超過 ${formatTWD(-(row.remaining ?? 0))}`;
  if (reason === "pace") return row.remaining === null ? "照速度會超過" : `快超過・剩 ${formatTWD(row.remaining)}`;
  return "習慣性超支";
}

/** 一句建議：超過用自己的話說，其餘沿用警示的句子 */
function sentence(row: WatchRow, reason: WatchReason, isCurrent: boolean, daysLeft: number): string {
  if (reason === "over" && row.baseline !== null && row.remaining !== null) {
    const base = `這個月已經花 ${formatTWD(row.spent)}，比額度 ${formatTWD(row.baseline)} 多了 ${formatTWD(-row.remaining)}。`;
    return isCurrent && daysLeft > 0 ? `${base}剩 ${daysLeft} 天，這一類先別再花。` : base;
  }
  return row.alert ? `${row.alert.title}。${row.alert.advice}` : "";
}

interface Editing {
  id: string;
  value: string;
}

/**
 * 本月頁版型 B：只展開「要注意的」類別（徽章、進度、一句建議），其餘收合成一列「都在範圍內」。
 * 兩邊的金額都可以點，改「這個月」的額度（存 budgets 表），類別的基準線不動。
 */
export function CategoryWatch({ ledgerId, month, isCurrent, attention, calm, expected, daysLeft, onSelect }: CategoryWatchProps) {
  const upsert = useUpsertMonthBudget();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [calmOpen, setCalmOpen] = useState(false);

  const startEdit = (row: WatchRow) => setEditing({ id: row.id, value: row.monthBudget === null ? "" : String(row.monthBudget) });

  const save = (row: WatchRow) => {
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

  const amountControl = (row: WatchRow) =>
    editing?.id === row.id ? (
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
          className="h-8 w-28 text-sm"
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
        {row.baseline !== null ? (
          <>
            {" / "}
            <strong className="text-foreground">{formatTWD(row.baseline)}</strong>
            {!row.usingBudget && <span>（三個月平均）</span>}
          </>
        ) : (
          <span>／設額度</span>
        )}
        <Pencil className="size-3" aria-hidden />
      </button>
    );

  const progress = (row: WatchRow, bar: string) =>
    row.baseline !== null && (
      <div aria-hidden className="relative h-2 overflow-hidden rounded-full bg-muted">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", bar)} style={{ width: `${Math.min(100, Math.round((row.ratio ?? 0) * 100))}%` }} />
        <span className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: `${Math.round(expected * 100)}%` }} />
      </div>
    );

  const nameButton = (row: WatchRow, className?: string) => (
    <button type="button" onClick={() => onSelect(row)} className={cn("min-w-0 truncate text-left font-bold underline-offset-4 hover:underline", className)} aria-label={`查看 ${row.name} 的交易`}>
      {row.name}
    </button>
  );

  if (attention.length === 0 && calm.length === 0) {
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

  const calmRemaining = calm.some((r) => r.remaining !== null) ? round2(calm.reduce((s, r) => s + (r.remaining ?? 0), 0)) : null;
  const calmSummary = calm
    .slice(0, 4)
    .map((r) => `${r.name} ${formatTWD(r.spent)}`)
    .join("、");

  return (
    <div className="grid gap-5">
      <section aria-label="要注意的類別" className="grid gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-foreground px-1 pb-2">
          <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground">{attention.length === 0 ? "要注意的" : `要注意的 ${attention.length} 類`}</span>
          <span className="text-xs text-muted-foreground">點金額改這個月的額度・點名稱看交易</span>
        </div>

        {attention.length === 0 ? (
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-income/10 px-4 py-3">
            <Stamp size="sm" className="border-income text-income">
              很乖
            </Stamp>
            <div>
              <div className="text-sm font-bold text-income">{isCurrent ? "這個月每一類都在範圍內" : "那個月每一類都在範圍內"}</div>
              <div className="text-xs text-muted-foreground">沒有超過額度，也沒有照速度會超過或習慣性超支的類別。</div>
            </div>
          </div>
        ) : (
          <ul>
            {attention.map((row) => {
              const reason = watchReason(row)!;
              const style = REASON_STYLE[reason];
              return (
                <li key={row.id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-dashed border-line py-4 last:border-0">
                  <AccountIcon icon={row.icon} color={row.color} />
                  <div className="grid min-w-0 gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {nameButton(row, "text-[15px]")}
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", style.badge)}>{badgeText(row, reason)}</span>
                      {row.monthBudget !== null && (
                        <Badge variant="outline" title={row.categoryBudget === null ? "這個月另外設的額度" : `類別基準線 ${formatTWD(row.categoryBudget)}`}>
                          本月
                        </Badge>
                      )}
                      <span className="ml-auto">{amountControl(row)}</span>
                    </div>
                    {progress(row, style.bar)}
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{sentence(row, reason, isCurrent, daysLeft)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {calm.length > 0 && (
        <section aria-label="在範圍內的類別" className="grid gap-3">
          <button
            type="button"
            aria-expanded={calmOpen}
            onClick={() => setCalmOpen((open) => !open)}
            className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-line px-4 py-3 text-left text-sm hover:bg-muted/40"
          >
            <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", calmOpen && "rotate-90")} aria-hidden />
            <strong>
              {attention.length === 0 ? `${calm.length} 類` : `其他 ${calm.length} 類`}都在範圍內
            </strong>
            {!calmOpen && (
              <span className="min-w-0 truncate text-muted-foreground">
                {calmSummary}
                {calm.length > 4 && "…"}
              </span>
            )}
            <span className="ml-auto text-xs font-bold text-income">
              {calmRemaining !== null && `還剩 ${formatTWD(calmRemaining)} 可用・`}
              {calmOpen ? "收起" : "點開看全部"}
            </span>
          </button>

          {calmOpen && (
            <ul className="grid gap-3 px-1">
              {calm.map((row) => (
                <li key={row.id} className="grid gap-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <AccountIcon icon={row.icon} color={row.color} size="sm" />
                    {nameButton(row)}
                    {row.monthBudget !== null && (
                      <Badge variant="outline" className="shrink-0" title={row.categoryBudget === null ? "這個月另外設的額度" : `類別基準線 ${formatTWD(row.categoryBudget)}`}>
                        本月
                      </Badge>
                    )}
                    <span className="ml-auto">{amountControl(row)}</span>
                  </div>
                  <div className="ml-9">{progress(row, row.level === "none" ? "bg-muted-foreground/60" : "bg-income")}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
