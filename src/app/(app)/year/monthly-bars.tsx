"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART, xAxisProps, yAxisProps } from "@/components/charts/chart-theme";
import type { MonthPoint } from "@/lib/ledger/chart-model";

interface MonthlyBarsProps {
  points: MonthPoint[];
  onSelectMonth: (month: string) => void;
}

/** 每個月的收入與支出並排雙長條；點一個月翻到那一章。下方有表格版。 */
export function MonthlyBars({ points, onSelectMonth }: MonthlyBarsProps) {
  return (
    <div className="grid gap-2">
      <div className="h-56 w-full" role="img" aria-label="每月收入與支出長條圖，數字見下方表格">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="28%"
            onClick={(state: { activeLabel?: string | number }) => {
              const point = points.find((p) => p.label === state.activeLabel);
              if (point) onSelectMonth(point.month);
            }}
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={
                <ChartTooltip
                  title={(label) => String(label ?? "")}
                  rows={(payload) => {
                    const point = (payload[0] as { payload?: MonthPoint } | undefined)?.payload;
                    return [
                      { name: "收入", value: point?.income ?? 0, color: CHART.income },
                      { name: "支出", value: point?.expense ?? 0, color: CHART.expense },
                    ];
                  }}
                />
              }
            />
            <Bar dataKey="income" name="收入" fill={CHART.income} maxBarSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false} cursor="pointer" />
            <Bar dataKey="expense" name="支出" fill={CHART.expense} maxBarSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: CHART.income }} />
          收入
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: CHART.expense }} />
          支出
        </span>
        <span className="ml-auto">點一個月翻到那一章</span>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer underline-offset-4 hover:underline">用表格看</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-medium">月份</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">收入</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">支出</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month} className="border-t border-line">
                <td className="px-2 py-1">
                  <button type="button" className="underline-offset-4 hover:underline" onClick={() => onSelectMonth(p.month)}>
                    {p.label}
                  </button>
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{p.income}</td>
                <td className="px-2 py-1 text-right tabular-nums">{p.expense}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
