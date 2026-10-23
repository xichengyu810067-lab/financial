"use client";

import { formatTWD } from "@/lib/ledger/format";

export interface TooltipRow {
  name: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ name?: string | number; value?: number | string | ReadonlyArray<number | string>; color?: string; dataKey?: string | number }>;
  /** 把資料鍵換成中文名稱與要顯示的值（例如支出是負數要翻回正數） */
  rows?: (payload: NonNullable<ChartTooltipProps["payload"]>) => TooltipRow[];
  title?: (label: string | number | undefined) => string;
}

/** 圖表的提示框：標題一行、每個系列一行（短色條 + 名稱 + 金額，金額是重點） */
export function ChartTooltip({ active, label, payload, rows, title }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const items: TooltipRow[] = rows
    ? rows(payload)
    : payload.map((p) => ({ name: String(p.name ?? p.dataKey ?? ""), value: Number(p.value ?? 0), color: p.color ?? "var(--foreground)" }));
  return (
    <div className="rounded-xl bg-card px-3 py-2 text-xs shadow-[0_8px_24px_rgba(43,36,32,0.18)] ring-1 ring-border">
      <div className="mb-1 font-bold">{title ? title(label) : String(label ?? "")}</div>
      <ul className="grid gap-0.5">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-bold tabular-nums">{formatTWD(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
