/**
 * 報表期間工具（純函式）。
 * 日期一律用 YYYY-MM-DD 字串，運算時以本地年月日建立 Date，避免時區位移。
 */

export type PeriodPreset = "month" | "quarter" | "year" | "custom";

export interface Period {
  preset: PeriodPreset;
  /** 起日（含） */
  from: string;
  /** 迄日（含） */
  to: string;
}

export type QuickOption = "this-month" | "last-month" | "this-quarter" | "last-quarter" | "this-year" | "last-year" | "custom";

export const QUICK_OPTIONS: { value: QuickOption; label: string }[] = [
  { value: "this-month", label: "本月" },
  { value: "last-month", label: "上月" },
  { value: "this-quarter", label: "本季" },
  { value: "last-quarter", label: "上季" },
  { value: "this-year", label: "今年" },
  { value: "last-year", label: "去年" },
  { value: "custom", label: "自訂區間" },
];

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTHS_PER: Record<Exclude<PeriodPreset, "custom">, number> = { month: 1, quarter: 3, year: 12 };

interface Ymd {
  y: number;
  /** 1–12 */
  m: number;
  d: number;
}

function parse(iso: string): Ymd {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

const pad = (n: number) => String(n).padStart(2, "0");

function format(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function fromDate(date: Date): string {
  return format(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function isValidISODate(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const { y, m, d } = parse(value);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parse(iso);
  return fromDate(new Date(y, m - 1, d + days));
}

/** 前一天（資產負債表的「期初」= 起日的前一天） */
export function dayBefore(iso: string): string {
  return addDays(iso, -1);
}

/** 起迄兩天都算進去的天數 */
export function daysBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1;
}

export function quarterOf(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

/** 從某年某月 1 日起、連續 months 個月 */
function monthSpan(preset: PeriodPreset, y: number, m: number, months: number): Period {
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m - 1 + months, 0); // 下個區段的第 0 天 = 本區段最後一天
  return { preset, from: fromDate(start), to: fromDate(end) };
}

export function monthPeriod(y: number, m: number): Period {
  return monthSpan("month", y, m, 1);
}

export function quarterPeriod(y: number, q: number): Period {
  return monthSpan("quarter", y, (q - 1) * 3 + 1, 3);
}

export function yearPeriod(y: number): Period {
  return monthSpan("year", y, 1, 12);
}

/** 包含某一天的月／季／年 */
export function periodContaining(preset: Exclude<PeriodPreset, "custom">, iso: string): Period {
  const { y, m } = parse(iso);
  switch (preset) {
    case "month":
      return monthPeriod(y, m);
    case "quarter":
      return quarterPeriod(y, quarterOf(m));
    case "year":
      return yearPeriod(y);
  }
}

/** 自訂區間；起迄顛倒就對調 */
export function customPeriod(from: string, to: string): Period {
  return from <= to ? { preset: "custom", from, to } : { preset: "custom", from: to, to: from };
}

/** 往前（delta < 0）或往後移同長度的期間：月→上下月、季→上下季、年→前後年、自訂→同天數 */
export function shiftPeriod(period: Period, delta: number): Period {
  if (period.preset === "custom") {
    const length = daysBetween(period.from, period.to);
    return { preset: "custom", from: addDays(period.from, delta * length), to: addDays(period.to, delta * length) };
  }
  const months = MONTHS_PER[period.preset];
  const { y, m } = parse(period.from);
  return monthSpan(period.preset, y, m + delta * months, months);
}

/** 上期 = 同長度的前一段 */
export function previousPeriod(period: Period): Period {
  return shiftPeriod(period, -1);
}

export function periodForQuickOption(option: Exclude<QuickOption, "custom">, today: string): Period {
  const { y, m } = parse(today);
  switch (option) {
    case "this-month":
      return monthPeriod(y, m);
    case "last-month":
      return shiftPeriod(monthPeriod(y, m), -1);
    case "this-quarter":
      return quarterPeriod(y, quarterOf(m));
    case "last-quarter":
      return shiftPeriod(quarterPeriod(y, quarterOf(m)), -1);
    case "this-year":
      return yearPeriod(y);
    case "last-year":
      return yearPeriod(y - 1);
  }
}

/** 目前期間對應哪個快速選項；都不是就回 "custom" */
export function quickOptionOf(period: Period, today: string): QuickOption {
  for (const option of QUICK_OPTIONS) {
    if (option.value === "custom") continue;
    const candidate = periodForQuickOption(option.value, today);
    if (candidate.preset === period.preset && candidate.from === period.from && candidate.to === period.to) {
      return option.value;
    }
  }
  return "custom";
}

/** 期間涵蓋的月份（YYYY-MM），依序 */
export function monthsInPeriod(period: Period): string[] {
  const a = parse(period.from);
  const b = parse(period.to);
  const months: string[] = [];
  let y = a.y;
  let m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    months.push(`${y}-${pad(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export function periodLabel(period: Period): string {
  const { y, m } = parse(period.from);
  switch (period.preset) {
    case "month":
      return `${y} 年 ${m} 月`;
    case "quarter":
      return `${y} 年第 ${quarterOf(m)} 季`;
    case "year":
      return `${y} 年`;
    case "custom":
      return `${period.from.replaceAll("-", "/")} – ${period.to.replaceAll("-", "/")}`;
  }
}

const weekdayFormatter = new Intl.DateTimeFormat("zh-TW", { weekday: "short" });

/** "2026-10-23" → "週五" */
export function weekdayShort(iso: string): string {
  const { y, m, d } = parse(iso);
  return weekdayFormatter.format(new Date(y, m - 1, d));
}

/** 一年中的第幾天（1 月 1 日 = 1） */
export function dayOfYear(iso: string): number {
  const { y } = parse(iso);
  return daysBetween(format(y, 1, 1), iso);
}

/** 該年有幾天 */
export function daysInYear(iso: string): number {
  const { y } = parse(iso);
  return daysBetween(format(y, 1, 1), format(y, 12, 31));
}

/** "2026-03" → "3 月" */
export function shortMonthLabel(month: string): string {
  return `${Number(month.slice(5, 7))} 月`;
}

/** 從網址參數還原期間；參數缺漏或無效一律回到本月 */
export function periodFromParams(
  params: { preset?: string | null; from?: string | null; to?: string | null },
  today: string,
): Period {
  const { preset, from, to } = params;
  if (preset === "custom" && isValidISODate(from) && isValidISODate(to)) return customPeriod(from, to);
  if (preset === "month" || preset === "quarter" || preset === "year") {
    return periodContaining(preset, isValidISODate(from) ? from : today);
  }
  return periodContaining("month", today);
}

export function periodToParams(period: Period): { preset: PeriodPreset; from: string; to: string } {
  return { preset: period.preset, from: period.from, to: period.to };
}
