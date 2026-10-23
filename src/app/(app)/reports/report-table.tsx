"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { AccountIcon } from "@/components/account-icon";
import { Stamp } from "@/components/journal/stamp";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, formatSignedTWD, formatTWD } from "@/lib/ledger/format";
import { changeOf, isZero } from "@/lib/ledger/report-model";

/**
 * 三張報表共用的表格零件：欄位標題、區段標題、可下鑽的科目列、合計列、檢核列，
 * 以及上方的摘要卡片。手機上以 hideOnMobile 隱藏次要欄位。
 */

export interface ReportColumn {
  label: string;
  align?: "left" | "right";
  hideOnMobile?: boolean;
  className?: string;
}

const cell = (align: "left" | "right" = "right", hideOnMobile?: boolean, className?: string) =>
  cn("px-2 py-2 align-middle", align === "right" ? "text-right tabular-nums" : "text-left", hideOnMobile && "hidden sm:table-cell", className);

export function ReportTable({ columns, caption, children }: { columns: ReportColumn[]; caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-dashed border-line text-xs text-muted-foreground">
            {columns.map((column) => (
              <th key={column.label} scope="col" className={cn(cell(column.align ?? "right", column.hideOnMobile, column.className), "py-1.5 font-medium")}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** 區段標題（收入／費用／資產…）：粗體小字 + 一條細線 */
export function SectionRow({ label, description, colSpan }: { label: string; description?: string; colSpan: number }) {
  return (
    <tr>
      <th scope="rowgroup" colSpan={colSpan} className="px-2 pt-5 pb-1 text-left">
        <div className="flex flex-wrap items-baseline gap-2 border-b border-foreground pb-1">
          <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground">{label}</span>
          {description && <span className="text-xs font-normal text-muted-foreground">{description}</span>}
        </div>
      </th>
    </tr>
  );
}

interface LineRowProps {
  name: string;
  icon?: string | null;
  color?: string | null;
  /** 0 = 頂層，1 = 子類別 */
  depth?: 0 | 1;
  tags?: ReactNode;
  /** 有就可點（下鑽） */
  onSelect?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

/** 科目列：整列可點進明細；父類別多一個展開／收合鈕 */
export function LineRow({ name, icon, color, depth = 0, tags, onSelect, expandable, expanded, onToggle, children }: LineRowProps) {
  return (
    <tr
      className={cn("border-b border-dashed border-line last:border-0", onSelect && "cursor-pointer hover:bg-muted/40")}
      onClick={onSelect}
    >
      <td className={cn("px-2 py-1.5", depth === 1 && "pl-8")}>
        <div className="flex min-w-0 items-center gap-2">
          {expandable ? (
            <button
              type="button"
              aria-label={expanded ? `收合 ${name} 的子類別` : `展開 ${name} 的子類別`}
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation();
                onToggle?.();
              }}
              className="-ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {expanded ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
            </button>
          ) : null}
          {icon !== undefined && <AccountIcon icon={icon} color={color} size="sm" />}
          {onSelect ? (
            <button type="button" className="truncate text-left font-medium underline-offset-4 hover:underline" aria-label={`查看 ${name} 的明細`}>
              {name}
            </button>
          ) : (
            <span className="truncate font-medium">{name}</span>
          )}
          {tags}
        </div>
      </td>
      {children}
    </tr>
  );
}

type Tone = "income" | "expense" | "muted" | "none";

const TONE_CLASS: Record<Tone, string> = {
  income: "text-income",
  expense: "text-expense",
  muted: "text-muted-foreground",
  none: "",
};

export function MoneyCell({
  value,
  tone = "none",
  strong,
  hideOnMobile,
  className,
}: {
  value: number;
  tone?: Tone;
  strong?: boolean;
  hideOnMobile?: boolean;
  className?: string;
}) {
  return <td className={cn(cell("right", hideOnMobile, className), TONE_CLASS[tone], strong && "font-bold")}>{formatTWD(value)}</td>;
}

/** 正綠負紅；invert 時相反（負債增加是壞事）；colorize=false 一律中性色 */
function toneFor(value: number, colorize: boolean, invert?: boolean): Tone {
  if (isZero(value)) return "muted";
  if (!colorize) return "none";
  return value > 0 !== Boolean(invert) ? "income" : "expense";
}

/** 帶正負號的金額（例如淨額、變化） */
export function SignedCell({
  value,
  colorize = true,
  invert,
  strong,
  hideOnMobile,
}: {
  value: number;
  /** 費用類增減沒有絕對好壞時傳 false 用中性色 */
  colorize?: boolean;
  invert?: boolean;
  strong?: boolean;
  hideOnMobile?: boolean;
}) {
  return <td className={cn(cell("right", hideOnMobile), TONE_CLASS[toneFor(value, colorize, invert)], strong && "font-bold")}>{formatSignedTWD(value)}</td>;
}

/** 本期相對上期的變化：金額 + 百分比（上期為 0 時只有金額） */
export function DeltaCell({
  current,
  previous,
  colorize = true,
  invert,
  hideOnMobile,
}: {
  current: number;
  previous: number;
  colorize?: boolean;
  invert?: boolean;
  hideOnMobile?: boolean;
}) {
  const { amount, percent } = changeOf(current, previous);
  const tone = toneFor(amount, colorize, invert);
  return (
    <td className={cell("right", hideOnMobile)}>
      <span className={cn("block", TONE_CLASS[tone])}>{formatSignedTWD(amount)}</span>
      {percent !== null && <span className="block text-[11px] leading-tight text-muted-foreground">{formatPercent(percent, true)}</span>}
    </td>
  );
}

/** 佔比：數字旁一條細比例條，一眼看出大項 */
export function PercentCell({ value, hideOnMobile }: { value: number | null; hideOnMobile?: boolean }) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <td className={cn(cell("right", hideOnMobile), "text-muted-foreground")}>
      <span className="inline-flex items-center justify-end gap-2">
        <span aria-hidden className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-foreground/50" style={{ width: `${width}%` }} />
        </span>
        <span className="w-12 text-right">{formatPercent(value)}</span>
      </span>
    </td>
  );
}

export function EmptyCell({ hideOnMobile }: { hideOnMobile?: boolean }) {
  return <td className={cell("right", hideOnMobile)} />;
}

/** 合計列：上方一條實線，粗體 */
export function TotalRow({ label, emphasis, children }: { label: string; emphasis?: boolean; children: ReactNode }) {
  return (
    <tr className={cn("border-t border-line font-bold", emphasis && "bg-muted/40 text-[15px]")}>
      <td className="px-2 py-2">{label}</td>
      {children}
    </tr>
  );
}

/** 檢核列：差額為 0 時一行淡綠加小印章，否則紅色顯示差額 */
export function CheckRow({ label, difference, colSpan }: { label: string; difference: number; colSpan: number }) {
  const ok = isZero(difference);
  return (
    <tr>
      <td colSpan={colSpan} className="px-2 pt-4 pb-1">
        <div
          role="status"
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm",
            ok ? "bg-income/10 text-income" : "bg-expense/10 text-expense",
          )}
        >
          <span className="inline-flex items-center gap-2">
            {ok ? <Check className="size-4" aria-hidden strokeWidth={2.5} /> : <TriangleAlert className="size-4" aria-hidden />}
            {label}
          </span>
          {ok ? (
            <Stamp size="sm" className="-mr-1 border-income text-income">
              平衡
            </Stamp>
          ) : (
            <span className="font-bold tabular-nums">差額 {formatSignedTWD(difference)}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export interface StatTile {
  label: string;
  value: number;
  hint?: string;
  tone?: Tone;
  /** 卡片上緣那條線的顏色：accent = 主題色、mint = 收入綠、sun = 警示橙 */
  tape?: "accent" | "mint" | "sun";
  stamp?: string;
}

const TAPE_CLASS: Record<NonNullable<StatTile["tape"]>, string> = {
  accent: "border-t-primary",
  mint: "border-t-income",
  sun: "border-t-warning",
};

/** 報表上方的三張摘要卡：細色線在上緣，重點卡蓋一個小印章 */
export function StatTiles({ items }: { items: StatTile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} size="sm" className={cn("border-t-[3px]", item.stamp ? "border-t-foreground" : TAPE_CLASS[item.tape ?? "accent"])}>
          {item.stamp && (
            <Stamp size="sm" className="absolute top-2 right-3">
              {item.stamp}
            </Stamp>
          )}
          <CardContent className={cn("grid gap-0.5", item.stamp && "pr-14")}>
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span className={cn("truncate text-xl font-bold tabular-nums", TONE_CLASS[item.tone ?? "none"])}>{formatTWD(item.value)}</span>
            {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-[18px]" />
        <Skeleton className="h-20 rounded-[18px]" />
        <Skeleton className="h-20 rounded-[18px]" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function ReportError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-dashed border-expense/60 bg-expense/5 px-4 py-6 text-center text-sm text-expense">
      報表載入失敗：{message}
    </p>
  );
}

export function EmptyReport({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">{text}</p>;
}
