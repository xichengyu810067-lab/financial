"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART, xAxisProps, yAxisProps } from "@/components/charts/chart-theme";
import type { NetWorthPoint } from "@/lib/ledger/chart-model";
import { formatTWD } from "@/lib/ledger/format";

interface NetWorthAreaProps {
  points: NetWorthPoint[];
}

/** 淨值走勢：一條 2px 的主題色線，底下一層淡淡的水彩；只有一個系列所以不用圖例 */
export function NetWorthArea({ points }: NetWorthAreaProps) {
  if (points.length === 0) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">這一年還沒有資料。</p>;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <div className="grid gap-2">
      <div className="h-44 w-full" role="img" aria-label={`淨值走勢：${first.label} ${formatTWD(first.netWorth)} 到 ${last.label} ${formatTWD(last.netWorth)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={
                <ChartTooltip
                  title={(label) => String(label ?? "")}
                  rows={(payload) => {
                    const point = (payload[0] as { payload?: NetWorthPoint } | undefined)?.payload;
                    return [{ name: "淨值", value: point?.netWorth ?? 0, color: CHART.accent }];
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              name="淨值"
              stroke={CHART.accent}
              strokeWidth={2}
              fill={CHART.accent}
              fillOpacity={0.1}
              dot={{ r: 4, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: CHART.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>
          {first.label} {formatTWD(first.netWorth)}
        </span>
        <span>
          {last.label} {formatTWD(last.netWorth)}
        </span>
      </div>
    </div>
  );
}
