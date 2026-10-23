"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART, xAxisProps, yAxisProps } from "@/components/charts/chart-theme";
import type { DailyPoint } from "@/lib/ledger/chart-model";
import { dayLabel } from "@/lib/ledger/entries";

interface DailyBarsProps {
  points: DailyPoint[];
  /** 用主題色標出的那一天（今天） */
  highlightDay?: string;
  onSelectDay: (day: string) => void;
}

/**
 * 每日收支：收入往上、支出往下，共用一條基線；今天用主題色。
 * 點一根（或鍵盤選到後按 Enter）看那天的交易；下方有表格版給螢幕閱讀器。
 */
export function DailyBars({ points, highlightDay, onSelectDay }: DailyBarsProps) {
  const tickEvery = points.length > 14 ? 7 : 1;
  return (
    <div className="grid gap-2">
      <div className="h-56 w-full" role="img" aria-label="每日收入與支出長條圖，數字見下方表格">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap={2}
            stackOffset="sign"
            onClick={(state: { activeLabel?: string | number }) => {
              const point = points.find((p) => p.label === state.activeLabel);
              if (point) onSelectDay(point.day);
            }}
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
            <XAxis dataKey="label" {...xAxisProps} interval={tickEvery - 1} />
            <YAxis {...yAxisProps} />
            <ReferenceLine y={0} stroke="var(--foreground)" strokeWidth={1} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={
                <ChartTooltip
                  title={(label) => {
                    const point = points.find((p) => p.label === label);
                    return point ? dayLabel(point.day) : String(label ?? "");
                  }}
                  rows={(payload) => {
                    const point = payload[0]?.dataKey !== undefined ? points.find((p) => p.label === String((payload[0] as { payload?: DailyPoint }).payload?.label)) : undefined;
                    return [
                      { name: "收入", value: point?.income ?? 0, color: CHART.income },
                      { name: "支出", value: point?.expense ?? 0, color: CHART.expense },
                    ];
                  }}
                />
              }
            />
            <Bar dataKey="income" name="收入" stackId="day" fill={CHART.income} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} cursor="pointer">
              {points.map((p) => (
                <Cell key={p.day} fill={p.day === highlightDay ? CHART.accent : CHART.income} />
              ))}
            </Bar>
            <Bar dataKey="expenseDown" name="支出" stackId="day" fill={CHART.expense} maxBarSize={24} radius={[0, 0, 4, 4]} isAnimationActive={false} cursor="pointer">
              {points.map((p) => (
                <Cell key={p.day} fill={p.day === highlightDay ? CHART.accent : CHART.expense} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: CHART.income }} />
          收入（往上）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: CHART.expense }} />
          支出（往下）
        </span>
        {highlightDay && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: CHART.accent }} />
            今天
          </span>
        )}
        <span className="ml-auto">點一根看那天的交易</span>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer underline-offset-4 hover:underline">用表格看</summary>
        <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th scope="col" className="px-2 py-1 text-left font-medium">日期</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">收入</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">支出</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">筆數</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day} className="border-t border-line">
                  <td className="px-2 py-1">
                    <button type="button" className="underline-offset-4 hover:underline" onClick={() => onSelectDay(p.day)}>
                      {p.day}
                    </button>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.income}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.expense}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{p.entryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
