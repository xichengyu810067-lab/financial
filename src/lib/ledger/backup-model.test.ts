import { describe, expect, it } from "vitest";
import { backupFileName, buildBackup, parseBackup, type BackupParts } from "./backup-model";

const L = "ledger-1";
const ts = "2026-11-01T08:00:00+00:00";

function account(id: string, name: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    ledger_id: L,
    name,
    type,
    subtype: null,
    icon: null,
    color: null,
    is_system: false,
    is_archived: false,
    sort_order: 10,
    parent_id: null,
    monthly_budget: null,
    created_at: ts,
    ...extra,
  };
}

function entry(id: string, kind: string, date: string, amount: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    ledger_id: L,
    kind,
    entry_date: date,
    amount,
    from_account_id: null,
    to_account_id: null,
    category_id: null,
    memo: null,
    created_by: "user-1",
    created_at: ts,
    updated_at: ts,
    ...extra,
  };
}

function line(entryId: string, accountId: string, debit: number, credit: number) {
  return { id: `${entryId}-${accountId}`, entry_id: entryId, ledger_id: L, account_id: accountId, debit, credit };
}

/** 資料庫查出來的樣子（含 ledger_id 等欄位） */
function parts(): BackupParts {
  return {
    ledger: { id: L, owner_id: "user-1", name: "我的帳本", currency: "TWD", start_date: "2026-10-01", cover_color: "rose", cover_material: "linen", monthly_spending_limit: 20000, created_at: ts },
    profile: { id: "user-1", display_name: "小明", slogan: null, animations_enabled: true, onboarded_at: ts, created_at: ts },
    accounts: [
      account("cash", "現金", "asset", { subtype: "cash" }),
      account("opening", "期初餘額", "equity", { subtype: "opening_balance", is_system: true }),
      account("salary", "薪資", "revenue"),
      account("food", "飲食", "expense"),
      account("snack", "零食", "expense", { parent_id: "food" }),
    ],
    entries: [
      entry("e0", "opening", "2026-10-01", 5000, { to_account_id: "cash" }),
      entry("e1", "income", "2026-10-05", 30000, { to_account_id: "cash", category_id: "salary" }),
      entry("e2", "expense", "2026-11-02", 85.5, { from_account_id: "cash", category_id: "snack", memo: "鹹酥雞" }),
    ],
    entry_lines: [
      line("e0", "cash", 5000, 0),
      line("e0", "opening", 0, 5000),
      line("e1", "cash", 30000, 0),
      line("e1", "salary", 0, 30000),
      line("e2", "snack", 85.5, 0),
      line("e2", "cash", 0, 85.5),
    ],
    budgets: [{ id: "b1", ledger_id: L, category_id: "food", month: "2026-11-01", amount: 6000, created_at: ts }],
    goals: [
      { id: "g1", ledger_id: L, name: "新手機", target_amount: 20000, target_date: null, account_id: null, note: null, is_archived: false, achieved_at: null, sort_order: 10, created_at: ts },
      { id: "g2", ledger_id: L, name: "旅行", target_amount: 50000, target_date: "2027-06-30", account_id: "cash", note: "日本", is_archived: false, achieved_at: null, sort_order: 20, created_at: ts },
    ],
    goal_deposits: [{ id: "d1", ledger_id: L, goal_id: "g1", amount: 3000, deposit_date: "2026-11-03", note: "第一筆", created_at: ts }],
  };
}

const text = (value: unknown) => JSON.stringify(value);
const exported = () => buildBackup(parts(), new Date("2026-11-18T10:00:00Z"));

describe("buildBackup", () => {
  it("組出固定格式，去掉 ledger_id／created_by 與分錄、預算、存入的 id", () => {
    const backup = exported();
    expect(backup.app).toBe("financial");
    expect(backup.version).toBe(1);
    expect(backup.exported_at).toBe("2026-11-18T10:00:00.000Z");
    expect(backup.ledger).toEqual({ name: "我的帳本", start_date: "2026-10-01", cover_color: "rose", cover_material: "linen", monthly_spending_limit: 20000 });
    expect(backup.profile).toEqual({ display_name: "小明", slogan: null, animations_enabled: true });
    expect(backup.accounts[0]).not.toHaveProperty("ledger_id");
    expect(backup.entries[0]).not.toHaveProperty("created_by");
    expect(backup.entry_lines[0]).toEqual({ entry_id: "e0", account_id: "cash", debit: 5000, credit: 0 });
    expect(backup.budgets[0]).not.toHaveProperty("id");
    expect(backup.goals[0]).toHaveProperty("id", "g1");
  });

  it("沒有 profile 時是 null", () => {
    expect(buildBackup({ ...parts(), profile: null }).profile).toBeNull();
  });
});

describe("backupFileName", () => {
  it("用本地日期", () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe("帳本備份-2026-01-05.json");
  });
});

describe("parseBackup", () => {
  it("匯出的檔案可以原樣讀回來，摘要正確", () => {
    const result = parseBackup(text(exported()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toEqual({
      ledgerName: "我的帳本",
      exportedAt: "2026-11-18T10:00:00.000Z",
      accountCount: 1,
      categoryCount: 3,
      entryCount: 3,
      firstDate: "2026-10-05",
      lastDate: "2026-11-02",
      budgetCount: 1,
      goalCount: 2,
      depositCount: 1,
      recurringCount: 0,
      categoryRuleCount: 0,
    });
  });

  it("只有期初的帳本：日期範圍為 null", () => {
    const backup = exported();
    backup.entries = backup.entries.slice(0, 1);
    backup.entry_lines = backup.entry_lines.slice(0, 2);
    const result = parseBackup(text(backup));
    expect(result.ok && result.summary.firstDate).toBeNull();
  });

  it.each([
    ["不是 JSON", "{oops", "這不是 JSON 檔"],
    ["別的 App", text({ app: "other", version: 1 }), "這不是本 App 的備份檔"],
    ["陣列", text([1, 2]), "這不是本 App 的備份檔"],
    ["版本不對", text({ ...exported(), version: 2 }), "不支援的備份版本（2）"],
  ])("%s → 擋下", (_label, input, message) => {
    const result = parseBackup(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it("缺欄位時指出位置", () => {
    const backup = exported();
    delete (backup.entries[1] as Record<string, unknown>).entry_date;
    const result = parseBackup(text(backup));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("備份檔格式不正確（entries.1.entry_date）");
  });

  it("借貸不平衡 → 擋下並指出哪一筆", () => {
    const backup = exported();
    backup.entry_lines[4] = { ...backup.entry_lines[4], debit: 86 };
    const result = parseBackup(text(backup));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("備份檔裡有借貸不平衡的交易（2026-11-02「鹹酥雞」）");
  });

  it("小數金額用分比對，不會因浮點誤差誤判", () => {
    const backup = exported();
    backup.entries[2] = { ...backup.entries[2], amount: 0.3 };
    backup.entry_lines[4] = { ...backup.entry_lines[4], debit: 0.1 };
    backup.entry_lines.push({ entry_id: "e2", account_id: "snack", debit: 0.2, credit: 0 });
    backup.entry_lines[5] = { ...backup.entry_lines[5], credit: 0.3 };
    expect(parseBackup(text(backup)).ok).toBe(true);
  });

  it("交易沒有分錄 → 擋下", () => {
    const backup = exported();
    backup.entry_lines = backup.entry_lines.filter((l) => l.entry_id !== "e1");
    expect(parseBackup(text(backup)).ok).toBe(false);
  });

  it("分錄同時有借貸 → 擋下", () => {
    const backup = exported();
    backup.entry_lines[0] = { ...backup.entry_lines[0], credit: 1 };
    const result = parseBackup(text(backup));
    expect(!result.ok && result.error).toBe("備份檔裡有分錄同時有借貸或金額為 0");
  });

  it.each([
    ["交易指到不存在的類別", (b: ReturnType<typeof exported>) => (b.entries[2] = { ...b.entries[2], category_id: "nope" }), "交易指到不存在"],
    ["分錄指到不存在的科目", (b: ReturnType<typeof exported>) => (b.entry_lines[0] = { ...b.entry_lines[0], account_id: "nope" }), "分錄指到不存在"],
    ["上層類別不存在", (b: ReturnType<typeof exported>) => (b.accounts[4] = { ...b.accounts[4], parent_id: "nope" }), "上層類別不存在"],
    ["預算掛在收入類別", (b: ReturnType<typeof exported>) => (b.budgets[0] = { ...b.budgets[0], category_id: "salary" }), "預算指到不存在的費用類別"],
    ["目標綁到類別", (b: ReturnType<typeof exported>) => (b.goals[1] = { ...b.goals[1], account_id: "food" }), "目標綁到不存在的帳戶"],
    ["存入指到不存在的目標", (b: ReturnType<typeof exported>) => (b.goal_deposits[0] = { ...b.goal_deposits[0], goal_id: "nope" }), "存入紀錄指到不存在"],
    ["重複的 id", (b: ReturnType<typeof exported>) => b.accounts.push({ ...b.accounts[0] }), "重複的 id"],
    ["缺少期初餘額科目", (b: ReturnType<typeof exported>) => (b.accounts[1] = { ...b.accounts[1], subtype: null }), "缺少「期初餘額」科目"],
  ])("%s → 擋下", (_label, mutate, message) => {
    const backup = exported();
    mutate(backup);
    const result = parseBackup(text(backup));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});

describe("固定支出與分類規則（里程碑 7）", () => {
  const withRules = () =>
    buildBackup({
      ...parts(),
      recurring_rules: [
        {
          id: "r1", ledger_id: L, name: "房租", kind: "expense", amount: 12000, amount_varies: false, from_account_id: "cash", to_account_id: null,
          category_id: "food", memo: null, frequency: "monthly", day_of_month: 5, weekday: null, month_of_year: null, next_date: "2026-12-05",
          is_active: true, created_at: ts,
        },
      ],
      category_rules: [{ id: "c1", ledger_id: L, pattern: "全家", category_id: "food", account_id: "cash", sort_order: 0, created_at: ts }],
    });

  it("匯出時去掉 id 與 ledger_id，讀回來摘要有數量", () => {
    const backup = withRules();
    expect(backup.recurring_rules[0]).not.toHaveProperty("id");
    expect(backup.category_rules[0]).not.toHaveProperty("ledger_id");
    const result = parseBackup(text(backup));
    expect(result.ok && result.summary.recurringCount).toBe(1);
    expect(result.ok && result.summary.categoryRuleCount).toBe(1);
  });

  it("舊備份沒有這兩項也能讀", () => {
    const old = exported() as Record<string, unknown>;
    delete old.recurring_rules;
    delete old.category_rules;
    const result = parseBackup(text(old));
    expect(result.ok && result.backup.recurring_rules).toEqual([]);
  });

  it("規則指到不存在的類別 → 擋下", () => {
    const backup = withRules();
    backup.category_rules[0] = { ...backup.category_rules[0], category_id: "nope" };
    const result = parseBackup(text(backup));
    expect(!result.ok && result.error).toContain("分類規則");
  });
});
