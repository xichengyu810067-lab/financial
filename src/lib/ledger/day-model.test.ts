import { describe, expect, it } from "vitest";
import { compareChip, netWorthChange } from "./day-model";
import { dayOfYear, daysInYear } from "./period";

describe("一天一頁的比較文字", () => {
  it("收入、支出、結餘各有自己的說法", () => {
    expect(compareChip("income", 50000, 0, "昨天")).toEqual({ text: "比昨天多 $50,000", tone: "good" });
    expect(compareChip("income", 0, 1200, "上週五")).toEqual({ text: "比上週五少 $1,200", tone: "bad" });
    expect(compareChip("expense", 155, 620, "昨天")).toEqual({ text: "比昨天少花 $465", tone: "good" });
    expect(compareChip("expense", 900, 620, "昨天")).toEqual({ text: "比昨天多花 $280", tone: "bad" });
    expect(compareChip("net", 49845, -620, "昨天")).toEqual({ text: "比昨天多存 $50,465", tone: "good" });
    expect(compareChip("net", -300, 100, "昨天")).toEqual({ text: "比昨天少存 $400", tone: "bad" });
    expect(compareChip("net", 100, 100, "昨天")).toEqual({ text: "跟昨天一樣", tone: "flat" });
  });

  it("淨值變化", () => {
    expect(netWorthChange(118145, 68300)).toEqual({ text: "▲ $49,845", tone: "good" });
    expect(netWorthChange(68300, 68920)).toEqual({ text: "▼ $620", tone: "bad" });
    expect(netWorthChange(1, 1)).toEqual({ text: "持平", tone: "flat" });
  });

  it("第幾頁", () => {
    expect(dayOfYear("2026-01-01")).toBe(1);
    expect(dayOfYear("2026-10-23")).toBe(296);
    expect(daysInYear("2026-06-01")).toBe(365);
    expect(daysInYear("2024-06-01")).toBe(366);
  });
});
