import { describe, expect, it } from "vitest";
import { aggregateStats, evaluateSpendingAlerts, monthContext, type CategoryStat } from "./alerts";
import type { Entry } from "./entries";

const stat = (overrides: Partial<CategoryStat> & Pick<CategoryStat, "account_id" | "name">): CategoryStat => ({
  parent_id: null,
  icon: null,
  color: null,
  is_archived: false,
  sort_order: 0,
  monthly_budget: null,
  month_budget: null,
  month_to_date: 0,
  month_count: 0,
  prev3_avg: 0,
  prev3_months: 0,
  recent_avg_entry: 0,
  recent_count: 0,
  ...overrides,
});

const entry = (overrides: Partial<Entry> & Pick<Entry, "id" | "amount" | "category_id">): Entry => ({
  ledger_id: "L",
  kind: "expense",
  entry_date: "2026-10-23",
  from_account_id: "cash",
  to_account_id: null,
  memo: null,
  created_by: "u",
  created_at: "2026-10-23T00:00:00Z",
  updated_at: "2026-10-23T00:00:00Z",
  ...overrides,
});

const AS_OF = "2026-10-23";

describe("月份脈絡", () => {
  it("天數與第幾天", () => {
    expect(monthContext("2026-10-23")).toEqual({ daysInMonth: 31, dayOfMonth: 23 });
    expect(monthContext("2026-02-10")).toEqual({ daysInMonth: 28, dayOfMonth: 10 });
  });
});

describe("父子類別彙總", () => {
  it("父類別含子類別的金額、筆數與平均", () => {
    const { parents, children } = aggregateStats([
      stat({ account_id: "food", name: "飲食", monthly_budget: 7500, month_to_date: 155, month_count: 1, recent_avg_entry: 100, recent_count: 2 }),
      stat({ account_id: "lunch", name: "午餐", parent_id: "food", month_to_date: 2000, month_count: 1, prev3_avg: 300, prev3_months: 1, recent_avg_entry: 400, recent_count: 2 }),
    ]);
    expect(parents).toHaveLength(1);
    expect(parents[0]).toMatchObject({ month_to_date: 2155, month_count: 2, prev3_avg: 300, prev3_months: 1, recent_avg_entry: 250, recent_count: 4 });
    expect(children).toHaveLength(1);
  });
});

describe("花過頭警示", () => {
  it("預估整月超過基準線 1.3 倍才警示", () => {
    const quiet = evaluateSpendingAlerts([stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 2400, month_count: 3 })], [], AS_OF);
    expect(quiet).toHaveLength(0);

    const loud = evaluateSpendingAlerts([stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 3900, month_count: 3 })], [], AS_OF);
    expect(loud).toHaveLength(1);
    expect(loud[0].level).toBe("red");
    expect(loud[0].title).toContain("購物照目前速度整月會花 $5,257");
    expect(loud[0].title).toContain("基準線 $3,000");
    expect(loud[0].advice).toContain("剩 8 天建議暫停非必要支出");
    expect(loud[0].ratio).toBeCloseTo(1.3, 5);
  });

  it("還沒超過基準線時建議每天的額度", () => {
    // 10/23 已花 2350（基準線 2400）：預估 3167 > 3120 警示；剩 8 天可花 50 → 每天 6
    const alerts = evaluateSpendingAlerts([stat({ account_id: "shop", name: "購物", monthly_budget: 2400, month_to_date: 2350, month_count: 4 })], [], AS_OF);
    expect(alerts[0].level).toBe("red");
    expect(alerts[0].advice).toBe("剩 8 天，建議每天 $6 內。");
  });

  it("沒填基準線的類別用前三個月平均；沒有歷史就不警示", () => {
    const withHistory = evaluateSpendingAlerts([stat({ account_id: "misc", name: "其他", month_to_date: 1500, month_count: 3, prev3_avg: 900, prev3_months: 2 })], [], AS_OF);
    expect(withHistory).toHaveLength(1);
    expect(withHistory[0].title).toContain("過去三個月平均 $900");

    const fresh = evaluateSpendingAlerts([stat({ account_id: "misc", name: "其他", month_to_date: 1500, month_count: 3 })], [], AS_OF);
    expect(fresh).toHaveLength(0);
  });

  it("月初前三天或不足兩筆不預估", () => {
    const early = evaluateSpendingAlerts([stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 2000, month_count: 2 })], [], "2026-10-02");
    expect(early).toHaveLength(0);
    const single = evaluateSpendingAlerts([stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 3900, month_count: 1 })], [], AS_OF);
    expect(single).toHaveLength(0);
  });

  it("習慣性超支 → 橙色；同類別已有紅色就不再給橙色", () => {
    const fun = stat({ account_id: "fun", name: "娛樂", monthly_budget: 3000, month_to_date: 2650, month_count: 4, prev3_avg: 4200, prev3_months: 3 });
    const alerts = evaluateSpendingAlerts([fun], [], AS_OF);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("orange");
    expect(alerts[0].title).toContain("高 40%");
    expect(alerts[0].advice).toContain("還在線內");

    const both = evaluateSpendingAlerts([stat({ ...fun, month_to_date: 3900 })], [], AS_OF);
    expect(both.map((a) => a.level)).toEqual(["red"]);
  });

  it("單筆大額：超過前 90 天平均單筆 3 倍且歷史至少 5 筆", () => {
    const stats = [stat({ account_id: "fun", name: "娛樂", recent_avg_entry: 200, recent_count: 5 })];
    const big = evaluateSpendingAlerts(stats, [entry({ id: "e1", amount: 1280, category_id: "fun" })], AS_OF);
    expect(big).toHaveLength(1);
    expect(big[0].level).toBe("large");
    expect(big[0].title).toBe("這筆娛樂 $1,280 是平常的 6.4 倍");

    const small = evaluateSpendingAlerts(stats, [entry({ id: "e2", amount: 500, category_id: "fun" })], AS_OF);
    expect(small).toHaveLength(0);
    const noHistory = evaluateSpendingAlerts([stat({ account_id: "fun", name: "娛樂", recent_avg_entry: 200, recent_count: 4 })], [entry({ id: "e3", amount: 1280, category_id: "fun" })], AS_OF);
    expect(noHistory).toHaveLength(0);
  });

  it("父類別以自身加子類別評估；子類別有自己的基準線才另外評估", () => {
    const stats = [
      stat({ account_id: "food", name: "飲食", monthly_budget: 2000, month_to_date: 155, month_count: 1 }),
      stat({ account_id: "lunch", name: "午餐", parent_id: "food", month_to_date: 2000, month_count: 3 }),
      stat({ account_id: "coffee", name: "咖啡", parent_id: "food", monthly_budget: 500, month_to_date: 900, month_count: 4 }),
    ];
    const alerts = evaluateSpendingAlerts(stats, [], AS_OF);
    expect(alerts.map((a) => a.categoryName)).toEqual(["咖啡", "飲食"]); // 咖啡超得更多排前面
    expect(alerts.every((a) => a.level === "red")).toBe(true);
  });

  it("當月覆寫優先於類別基準線", () => {
    // 基準線 3000 本來會紅（3900 → 預估 5257）；這個月覆寫成 6000 就不警示
    const overridden = evaluateSpendingAlerts([stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_budget: 6000, month_to_date: 3900, month_count: 3 })], [], AS_OF);
    expect(overridden).toHaveLength(0);
    // 沒基準線但這個月覆寫 2000 → 用 2000 當尺
    const onlyMonth = evaluateSpendingAlerts([stat({ account_id: "shop", name: "購物", month_budget: 2000, month_to_date: 2500, month_count: 3 })], [], AS_OF);
    expect(onlyMonth).toHaveLength(1);
    expect(onlyMonth[0].title).toContain("基準線 $2,000");
  });

  it("排序：紅色、單筆大額、橙色", () => {
    const stats = [
      stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 3900, month_count: 3 }),
      stat({ account_id: "fun", name: "娛樂", monthly_budget: 3000, month_to_date: 2650, month_count: 4, prev3_avg: 4200, prev3_months: 3, recent_avg_entry: 200, recent_count: 5 }),
    ];
    const alerts = evaluateSpendingAlerts(stats, [entry({ id: "e1", amount: 1280, category_id: "fun" })], AS_OF);
    expect(alerts.map((a) => a.level)).toEqual(["red", "large", "orange"]);
  });
});
