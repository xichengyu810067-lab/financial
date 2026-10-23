"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "cn";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART } from "@/components/charts/chart-theme";
import type { DonutSlice } from "@/lib/ledger/chart-model";
import { formatPercent, formatTWD } from "@/lib/ledger/format";

interface CategoryDonutProps {
  slices: DonutSlice[];
  total: number;
  onSelect: (slice: DonutSlice) => void;
}

/**
 * 支出類別占比：最多六片（尾巴合併成其他），片與片之間留 2px 紙色縫；
 * 顏色是類別自己的顏色，所以旁邊一定有名稱與金額的清單，不靠顏色辨認。
 */
export function CategoryDonut({ slices, total, onSelect }: CategoryDonutProps) {
  if (slices.length === 0) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">這個月還沒有支出。</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-44 shrink-0" role="img" aria-label={`支出類別占比：${slices.map((s) => `${s.name} ${formatPercent(s.percent)}`).join("、")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={2}
              stroke={CHART.surface}
              strokeWidth={2}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(_: unknown, index: number) => {
                const slice = slices[index];
                if (slice) onSelect(slice);
              }}
            >
              {slices.map((slice) => (
                <Cell key={slice.id ?? "other"} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  title={(label) => String(label ?? "")}
                  rows={(payload) => {
                    const item = payload[0] as { payload?: DonutSlice } | undefined;
                    const slice = item?.payload;
                    return slice ? [{ name: formatPercent(slice.percent), value: slice.value, color: slice.color }] : [];
                  }}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">本月支出</span>
          <span className="text-lg font-bold">{formatTWD(total)}</span>
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 gap-1 text-sm">
        {slices.map((slice) => (
          <li key={slice.id ?? "other"}>
            <button
              type="button"
              onClick={() => onSelect(slice)}
              className={cn("flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-muted/60")}
              aria-label={`查看 ${slice.name} 的交易`}
            >
              <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate">{slice.name}</span>
              <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{formatPercent(slice.percent)}</span>
              <span className="w-20 text-right font-bold tabular-nums">{formatTWD(slice.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
