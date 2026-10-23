import { describe, expect, it } from "vitest";
import type { CategoryStat } from "./alerts";
import { baselineRows, compactNumber, dailySeries, donutSlices, monthSeries, netWorthSeries } from "./chart-model";
import type { IncomeLine } from "./report-model";

const line = (id: string, name: string, current: number, color: string | null = null, children: IncomeLine[] = []): IncomeLine => ({
  id,
  name,
  icon: null,
  color,
  current,
  previous: 0,
  children,
});

const stat = (overrides: Partial<CategoryStat> & Pick<CategoryStat, "account_id" | "name">): CategoryStat => ({
  parent_id: null,
  icon: null,
  color: null,
  is_archived: false,
  sort_order: 0,
  monthly_budget: null,
  month_to_date: 0,
  month_count: 0,
  prev3_avg: 0,
  prev3_months: 0,
  recent_avg_entry: 0,
  recent_count: 0,
  ...overrides,
});

describe("圖表資料", () => {
  it("每日序列補齊沒交易的日子，支出畫成負值", () => {
    const series = dailySeries([{ day: "2026-10-02", income: 500, expense: 120, entryCount: 2 }], "2026-10-01", "2026-10-03");
    expect(series.map((p) => p.label)).toEqual(["10/1", "10/2", "10/3"]);
    expect(series[1]).toMatchObject({ income: 500, expense: 120, expenseDown: -120, entryCount: 2 });
    expect(series[0]).toMatchObject({ income: 0, expense: 0, expenseDown: 0, entryCount: 0 });
  });

  it("環圈：金額大的在前，超過六片把尾巴合併成其他", () => {
    const lines = [
      line("a", "飲食", 3000, "emerald", [line("a1", "午餐", 1000)]),
      line("b", "購物", 2500),
      line("c", "交通", 800),
      line("d", "娛樂", 700),
      line("e", "醫療", 300),
      line("f", "教育", 200),
      line("g", "保險", 100),
      line("h", "寵物", 50),
      line("zero", "空的", 0),
    ];
    const slices = donutSlices(lines);
    expect(slices).toHaveLength(6);
    expect(slices[0]).toMatchObject({ id: "a", name: "飲食", value: 3000, memberIds: ["a", "a1"] });
    expect(slices[0].color).toBe("#10b981");
    const other = slices[5];
    expect(other.id).toBeNull();
    expect(other.name).toBe("其他 3 類");
    expect(other.value).toBe(350);
    expect(other.memberIds).toEqual(["f", "g", "h"]);
    expect(round(slices.reduce((s, x) => s + x.percent, 0))).toBe(100);
  });

  it("六片以內不合併；全部為零就沒有切片", () => {
    expect(donutSlices([line("a", "飲食", 10), line("b", "購物", 5)]).map((s) => s.name)).toEqual(["飲食", "購物"]);
    expect(donutSlices([line("a", "飲食", 0)])).toEqual([]);
  });

  it("月序列與淨值走勢", () => {
    const months = monthSeries([{ month: "2026-02", income: 100, expense: 50 }], ["2026-01", "2026-02"]);
    expect(months).toEqual([
      { month: "2026-01", label: "1 月", income: 0, expense: 0 },
      { month: "2026-02", label: "2 月", income: 100, expense: 50 },
    ]);
    const nw = netWorthSeries(
      [
        { month: "2026-03", netWorth: 300 },
        { month: "2026-01", netWorth: 100 },
        { month: "2026-02", netWorth: 200 },
      ],
      "2026-02",
    );
    expect(nw.map((p) => p.netWorth)).toEqual([100, 200]);
  });

  it("精簡數字", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(850)).toBe("850");
    expect(compactNumber(1234)).toBe("1.2K");
    expect(compactNumber(50000)).toBe("50K");
    expect(compactNumber(1500000)).toBe("1.5M");
    expect(compactNumber(-800)).toBe("-800");
  });

  it("基準線進度：超標在前，沒基準線用前三個月平均，封存且沒花的不列", () => {
    const rows = baselineRows([
      stat({ account_id: "food", name: "飲食", monthly_budget: 7500, month_to_date: 2410, month_count: 3 }),
      stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 3900, month_count: 1, prev3_avg: 4000, prev3_months: 3 }),
      stat({ account_id: "fun", name: "娛樂", monthly_budget: 3000, month_to_date: 2650, month_count: 4, prev3_avg: 4200, prev3_months: 3 }),
      stat({ account_id: "misc", name: "其他", month_to_date: 515, month_count: 2, prev3_avg: 900, prev3_months: 2 }),
      stat({ account_id: "old", name: "舊的", is_archived: true }),
      stat({ account_id: "empty", name: "沒動靜" }),
    ]);
    expect(rows.map((r) => `${r.name}:${r.level}`)).toEqual(["購物:over", "娛樂:habit", "飲食:ok", "其他:ok"]);
    expect(rows[0].ratio).toBeCloseTo(1.3, 5);
    expect(rows[3]).toMatchObject({ baseline: 900, usingBudget: false });
  });
});

const round = (n: number) => Math.round(n * 1000) / 1000;
