import { describe, expect, it } from "vitest";
import {
  customPeriod,
  dayBefore,
  daysBetween,
  isValidISODate,
  monthPeriod,
  monthsInPeriod,
  periodContaining,
  periodForQuickOption,
  periodFromParams,
  periodLabel,
  previousPeriod,
  quarterPeriod,
  quickOptionOf,
  shiftPeriod,
  yearPeriod,
} from "./period";

const TODAY = "2026-10-23";

describe("預設期間", () => {
  it("月：含月底與閏年", () => {
    expect(monthPeriod(2026, 2)).toEqual({ preset: "month", from: "2026-02-01", to: "2026-02-28" });
    expect(monthPeriod(2024, 2)).toEqual({ preset: "month", from: "2024-02-01", to: "2024-02-29" });
    expect(monthPeriod(2026, 12)).toEqual({ preset: "month", from: "2026-12-01", to: "2026-12-31" });
  });

  it("季與年", () => {
    expect(quarterPeriod(2026, 4)).toEqual({ preset: "quarter", from: "2026-10-01", to: "2026-12-31" });
    expect(periodContaining("quarter", "2026-05-15")).toEqual({ preset: "quarter", from: "2026-04-01", to: "2026-06-30" });
    expect(yearPeriod(2026)).toEqual({ preset: "year", from: "2026-01-01", to: "2026-12-31" });
  });

  it("快速選項以今天為準", () => {
    expect(periodForQuickOption("this-month", TODAY)).toEqual(monthPeriod(2026, 10));
    expect(periodForQuickOption("last-month", TODAY)).toEqual(monthPeriod(2026, 9));
    expect(periodForQuickOption("this-quarter", TODAY)).toEqual(quarterPeriod(2026, 4));
    expect(periodForQuickOption("last-quarter", TODAY)).toEqual(quarterPeriod(2026, 3));
    expect(periodForQuickOption("this-year", TODAY)).toEqual(yearPeriod(2026));
    expect(periodForQuickOption("last-year", TODAY)).toEqual(yearPeriod(2025));
  });

  it("期間可以反查回快速選項", () => {
    expect(quickOptionOf(monthPeriod(2026, 10), TODAY)).toBe("this-month");
    expect(quickOptionOf(quarterPeriod(2026, 3), TODAY)).toBe("last-quarter");
    expect(quickOptionOf(yearPeriod(2025), TODAY)).toBe("last-year");
    expect(quickOptionOf(monthPeriod(2026, 3), TODAY)).toBe("custom");
    expect(quickOptionOf(customPeriod("2026-10-01", "2026-10-31"), TODAY)).toBe("custom");
  });
});

describe("往前後移與上期", () => {
  it("月跨年", () => {
    expect(shiftPeriod(monthPeriod(2026, 1), -1)).toEqual(monthPeriod(2025, 12));
    expect(shiftPeriod(monthPeriod(2026, 12), 1)).toEqual(monthPeriod(2027, 1));
  });

  it("季與年", () => {
    expect(shiftPeriod(quarterPeriod(2026, 1), -1)).toEqual(quarterPeriod(2025, 4));
    expect(shiftPeriod(quarterPeriod(2026, 4), 1)).toEqual(quarterPeriod(2027, 1));
    expect(shiftPeriod(yearPeriod(2026), -1)).toEqual(yearPeriod(2025));
  });

  it("自訂區間依同天數移動", () => {
    const period = customPeriod("2026-01-10", "2026-01-19");
    expect(daysBetween(period.from, period.to)).toBe(10);
    expect(shiftPeriod(period, -1)).toEqual({ preset: "custom", from: "2025-12-31", to: "2026-01-09" });
    expect(shiftPeriod(period, 1)).toEqual({ preset: "custom", from: "2026-01-20", to: "2026-01-29" });
  });

  it("上期就是往前一段", () => {
    expect(previousPeriod(monthPeriod(2026, 3))).toEqual(monthPeriod(2026, 2));
    expect(previousPeriod(yearPeriod(2026))).toEqual(yearPeriod(2025));
  });

  it("月底變化不會讓長度漂移", () => {
    const march = monthPeriod(2026, 3);
    expect(shiftPeriod(shiftPeriod(march, -1), 1)).toEqual(march);
  });
});

describe("日期工具", () => {
  it("合法性檢查", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2026/01/01")).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });

  it("前一天與天數", () => {
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
    expect(dayBefore("2026-01-01")).toBe("2025-12-31");
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(31);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(1);
  });

  it("期間涵蓋的月份", () => {
    const year = monthsInPeriod(yearPeriod(2026));
    expect(year).toHaveLength(12);
    expect(year[0]).toBe("2026-01");
    expect(year[11]).toBe("2026-12");
    expect(monthsInPeriod(customPeriod("2025-11-15", "2026-02-03"))).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("標籤", () => {
    expect(periodLabel(monthPeriod(2026, 10))).toBe("2026 年 10 月");
    expect(periodLabel(quarterPeriod(2026, 4))).toBe("2026 年第 4 季");
    expect(periodLabel(yearPeriod(2026))).toBe("2026 年");
    expect(periodLabel(customPeriod("2026-01-01", "2026-01-31"))).toBe("2026/01/01 – 2026/01/31");
  });
});

describe("網址參數", () => {
  it("缺漏或無效回到本月", () => {
    expect(periodFromParams({}, TODAY)).toEqual(monthPeriod(2026, 10));
    expect(periodFromParams({ preset: "weird" }, TODAY)).toEqual(monthPeriod(2026, 10));
    expect(periodFromParams({ preset: "custom", from: "2026-01-01" }, TODAY)).toEqual(monthPeriod(2026, 10));
    expect(periodFromParams({ preset: "custom", from: "2026-02-30", to: "2026-03-01" }, TODAY)).toEqual(monthPeriod(2026, 10));
  });

  it("月／季／年以 from 所在的區段為準，忽略不一致的 to", () => {
    expect(periodFromParams({ preset: "month", from: "2026-03-15", to: "2026-09-30" }, TODAY)).toEqual(monthPeriod(2026, 3));
    expect(periodFromParams({ preset: "quarter", from: "2026-08-01" }, TODAY)).toEqual(quarterPeriod(2026, 3));
    expect(periodFromParams({ preset: "year" }, TODAY)).toEqual(yearPeriod(2026));
  });

  it("自訂區間起迄顛倒會對調", () => {
    expect(periodFromParams({ preset: "custom", from: "2026-01-31", to: "2026-01-01" }, TODAY)).toEqual(
      customPeriod("2026-01-01", "2026-01-31"),
    );
  });
});
