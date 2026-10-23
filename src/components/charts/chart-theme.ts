import { compactNumber } from "@/lib/ledger/chart-model";

/**
 * 圖表共用的外觀：細線、淡格線、小字軸標；顏色用 CSS 變數讓深淺色都對。
 * 收入綠與支出紅已用 dataviz 的檢查工具驗過（淺色、深色各一組）。
 */
export const CHART = {
  income: "var(--chart-income)",
  expense: "var(--chart-expense)",
  accent: "var(--accent-from)",
  grid: "var(--line)",
  muted: "var(--muted-foreground)",
  surface: "var(--card)",
} as const;

export const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

export const yAxisProps = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: false,
  width: 44,
  tickFormatter: (value: number) => compactNumber(value),
} as const;

export const xAxisProps = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: { stroke: "var(--line)" },
} as const;
