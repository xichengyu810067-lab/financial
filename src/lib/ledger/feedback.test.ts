import { describe, expect, it } from "vitest";
import type { CategoryStat } from "./alerts";
import { feedbackForSave } from "./feedback";
import type { Account } from "./types";

const account = (overrides: Partial<Account> & Pick<Account, "id" | "name" | "type">): Account => ({
  ledger_id: "L",
  parent_id: null,
  subtype: null,
  icon: null,
  color: null,
  is_system: false,
  is_archived: false,
  sort_order: 0,
  monthly_budget: null,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

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

const TODAY = "2026-10-23";
const shop = account({ id: "shop", name: "購物", type: "expense", monthly_budget: 3000 });

describe("記帳後的動畫", () => {
  it("收入與轉進儲蓄／投資帳戶是存錢", () => {
    expect(feedbackForSave({ kind: "income", amount: 50000, date: TODAY, today: TODAY, category: account({ id: "salary", name: "薪資", type: "revenue" }) })).toMatchObject({ kind: "saving", label: "薪資" });
    expect(feedbackForSave({ kind: "transfer", amount: 5000, date: TODAY, today: TODAY, toAccount: account({ id: "sav", name: "定存", type: "asset", subtype: "savings" }) })).toMatchObject({ kind: "saving", label: "定存" });
    expect(feedbackForSave({ kind: "transfer", amount: 5000, date: TODAY, today: TODAY, toAccount: account({ id: "inv", name: "投資", type: "asset", subtype: "investment" }) })).toMatchObject({ kind: "saving" });
    expect(feedbackForSave({ kind: "transfer", amount: 5000, date: TODAY, today: TODAY, toAccount: account({ id: "card", name: "信用卡", type: "liability", subtype: "credit_card" }) })).toMatchObject({ kind: "stamp", label: "信用卡" });
  });

  it("一般支出蓋印章", () => {
    const stats = [stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 500, month_count: 2 })];
    expect(feedbackForSave({ kind: "expense", amount: 300, date: TODAY, today: TODAY, category: shop, stats })).toMatchObject({ kind: "stamp", label: "購物" });
  });

  it("這一筆讓本月速度超過基準線 30% 就變成超支", () => {
    const stats = [stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 3000, month_count: 2 })];
    const feedback = feedbackForSave({ kind: "expense", amount: 1000, date: TODAY, today: TODAY, category: shop, stats });
    expect(feedback.kind).toBe("overspend");
    expect(feedback.alert?.level).toBe("red");
    expect(feedback.alert?.title).toContain("購物照目前速度整月會花");
  });

  it("單筆大額也算超支", () => {
    const fun = account({ id: "fun", name: "娛樂", type: "expense" });
    const stats = [stat({ account_id: "fun", name: "娛樂", recent_avg_entry: 200, recent_count: 5 })];
    const feedback = feedbackForSave({ kind: "expense", amount: 1280, date: TODAY, today: TODAY, category: fun, stats });
    expect(feedback.kind).toBe("overspend");
    expect(feedback.alert?.level).toBe("large");
  });

  it("不是本月的交易不判斷超支", () => {
    const stats = [stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 3000, month_count: 2 })];
    expect(feedbackForSave({ kind: "expense", amount: 9000, date: "2026-09-10", today: TODAY, category: shop, stats }).kind).toBe("stamp");
  });

  it("編輯既有交易時扣掉原本的金額再判斷", () => {
    const stats = [stat({ account_id: "shop", name: "購物", monthly_budget: 3000, month_to_date: 3900, month_count: 2 })];
    const previous = { amount: 3900, date: "2026-10-10", categoryId: "shop" };
    expect(feedbackForSave({ kind: "expense", amount: 100, date: TODAY, today: TODAY, category: shop, stats, previous }).kind).toBe("stamp");
    expect(feedbackForSave({ kind: "expense", amount: 4100, date: TODAY, today: TODAY, category: shop, stats, previous }).kind).toBe("overspend");
  });

  it("子類別超支時看父類別的彙總", () => {
    const lunch = account({ id: "lunch", name: "午餐", type: "expense", parent_id: "food" });
    const stats = [
      stat({ account_id: "food", name: "飲食", monthly_budget: 2000, month_to_date: 500, month_count: 1 }),
      stat({ account_id: "lunch", name: "午餐", parent_id: "food", month_to_date: 1500, month_count: 2 }),
    ];
    const feedback = feedbackForSave({ kind: "expense", amount: 800, date: TODAY, today: TODAY, category: lunch, stats });
    expect(feedback.kind).toBe("overspend");
    expect(feedback.alert?.categoryName).toBe("飲食");
  });

  it("沒有統計資料或新類別時不會當掉", () => {
    expect(feedbackForSave({ kind: "expense", amount: 100, date: TODAY, today: TODAY, category: shop }).kind).toBe("stamp");
    expect(feedbackForSave({ kind: "expense", amount: 100, date: TODAY, today: TODAY, category: shop, stats: [] }).kind).toBe("stamp");
  });
});
