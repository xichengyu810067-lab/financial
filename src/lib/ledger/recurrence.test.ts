import { describe, expect, it } from "vitest";
import { describeSchedule, monthDay, recurrenceOnOrAfter, type Schedule } from "./recurrence";

const monthly = (day: number): Schedule => ({ frequency: "monthly", dayOfMonth: day, weekday: null, monthOfYear: null });
const weekly = (weekday: number): Schedule => ({ frequency: "weekly", dayOfMonth: null, weekday, monthOfYear: null });
const yearly = (month: number, day: number): Schedule => ({ frequency: "yearly", dayOfMonth: day, weekday: null, monthOfYear: month });

// 與 supabase/tests/inbox.sql 的週期檢查相同，確保前後端算法一致
describe("recurrenceOnOrAfter", () => {
  it.each([
    [monthly(31), "2027-02-01", "2027-02-28"],
    [monthly(31), "2027-03-01", "2027-03-31"],
    [monthly(5), "2026-11-05", "2026-11-05"],
    [monthly(5), "2026-12-06", "2027-01-05"],
    [monthly(30), "2028-02-01", "2028-02-29"],
    [weekly(1), "2026-11-18", "2026-11-23"],
    [weekly(3), "2026-11-18", "2026-11-18"],
    [weekly(0), "2026-12-28", "2027-01-03"],
    [yearly(2, 29), "2027-01-01", "2027-02-28"],
    [yearly(2, 29), "2027-03-01", "2028-02-29"],
  ])("%o 從 %s 起 → %s", (schedule, from, expected) => {
    expect(recurrenceOnOrAfter(schedule, from)).toBe(expected);
  });
});

describe("monthDay", () => {
  it("超過月底就落在月底", () => {
    expect(monthDay(2026, 4, 31)).toBe("2026-04-30");
    expect(monthDay(2026, 1, 9)).toBe("2026-01-09");
  });
});

describe("describeSchedule", () => {
  it("中文描述", () => {
    expect(describeSchedule(monthly(5))).toBe("每月 5 號");
    expect(describeSchedule(monthly(31))).toBe("每月月底（31 號）");
    expect(describeSchedule(weekly(1))).toBe("每週一");
    expect(describeSchedule(yearly(2, 29))).toBe("每年 2 月 29 日");
  });
});
