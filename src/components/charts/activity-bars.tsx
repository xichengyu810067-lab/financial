"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART, xAxisProps, yAxisProps } from "@/components/charts/chart-theme";
import type { ActivityPoint } from "@/lib/ledger/chart-model";
import { formatTWD } from "@/lib/ledger/format";

interface ActivityBarsProps {
  points: ActivityPoint[];
}

/** 現金流量表上方的圖：營業／投資／融資三組，流入往上、流出往下，共用一條基線；下方有表格版 */
export function ActivityBars({ points }: ActivityBarsProps) {
  if (points.every((p) => p.inflow === 0 && p.outflow === 0)) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">這段期間現金沒有進出。</p>;
  }
  return (
    <div className="grid gap-2">
      <div className="h-44 w-full" role="img" aria-label="營業、投資、融資三類活動的現金流入與流出長條圖，數字見下方表格">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="36%" stackOffset="sign">
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <ReferenceLine y={0} stroke="var(--foreground)" strokeWidth={1} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={
                <ChartTooltip
                  title={(label) => `${label ?? ""}活動`}
                  rows={(payload) => {
                    const point = (payload[0] as { payload?: ActivityPoint } | undefined)?.payload;
                    return [
                      { name: "流入", value: point?.inflow ?? 0, color: CHART.income },
                      { name: "流出", value: point?.outflow ?? 0, color: CHART.expense },
                      { name: "淨額", value: point?.net ?? 0, color: "var(--foreground)" },
                    ];
                  }}
                />
              }
            />
            <Bar dataKey="inflow" name="流入" stackId="flow" fill={CHART.income} maxBarSize={44} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="outflowDown" name="流出" stackId="flow" fill={CHART.expense} maxBarSize={44} radius={[0, 0, 4, 4]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: CHART.income }} />
          流入（往上）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: CHART.expense }} />
          流出（往下）
        </span>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer underline-offset-4 hover:underline">用表格看</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-medium">活動</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">流入</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">流出</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">淨額</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key} className="border-t border-line">
                <td className="px-2 py-1">{p.label}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatTWD(p.inflow)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatTWD(p.outflow)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatTWD(p.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
