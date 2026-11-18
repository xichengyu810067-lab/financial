/**
 * 固定支出的週期日期（里程碑 7）。規則與資料庫的 recurrence_on_or_after 相同，
 * 前端用來在表單上預覽「下次是哪天」；真正產生待確認項目時以資料庫為準。
 */

export type Frequency = "monthly" | "weekly" | "yearly";

export interface Schedule {
  frequency: Frequency;
  /** monthly／yearly：每月第幾天（1–31，超過月底就落在月底） */
  dayOfMonth: number | null;
  /** weekly：星期幾（0 = 週日） */
  weekday: number | null;
  /** yearly：幾月（1–12） */
  monthOfYear: number | null;
}

export const WEEKDAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 某年某月的第 d 天；超過月底就落在月底 */
export function monthDay(year: number, month: number, day: number): string {
  return iso(year, month, Math.min(day, daysInMonth(year, month)));
}

/** 週期在 from 當天或之後的第一個日期（YYYY-MM-DD） */
export function recurrenceOnOrAfter(schedule: Schedule, from: string): string {
  const [y, m, d] = parts(from);
  switch (schedule.frequency) {
    case "weekly": {
      const date = new Date(Date.UTC(y, m - 1, d));
      const shift = ((schedule.weekday ?? 0) - date.getUTCDay() + 7) % 7;
      date.setUTCDate(date.getUTCDate() + shift);
      return date.toISOString().slice(0, 10);
    }
    case "monthly": {
      const day = schedule.dayOfMonth ?? 1;
      const thisMonth = monthDay(y, m, day);
      if (thisMonth >= from) return thisMonth;
      return m === 12 ? monthDay(y + 1, 1, day) : monthDay(y, m + 1, day);
    }
    case "yearly": {
      const day = schedule.dayOfMonth ?? 1;
      const month = schedule.monthOfYear ?? 1;
      const thisYear = monthDay(y, month, day);
      return thisYear >= from ? thisYear : monthDay(y + 1, month, day);
    }
  }
}

/** 「每月 5 號」「每週一」「每年 2 月 29 日」 */
export function describeSchedule(schedule: Schedule): string {
  switch (schedule.frequency) {
    case "weekly":
      return `每${WEEKDAY_LABELS[schedule.weekday ?? 0]}`;
    case "monthly":
      return schedule.dayOfMonth === 31 ? "每月月底（31 號）" : `每月 ${schedule.dayOfMonth} 號`;
    case "yearly":
      return `每年 ${schedule.monthOfYear} 月 ${schedule.dayOfMonth} 日`;
  }
}
