import { z } from "zod";

/**
 * 帳本 JSON 備份（里程碑 6 PR C）：格式、驗證與摘要都是純函式，方便單元測試。
 * 匯出時每列去掉 ledger_id／created_by（還原會重新產生 id 並掛到目前帳本）；
 * 還原前在瀏覽器先驗證一次，資料庫的 restore_ledger 會再檢查一次並在同一個交易裡重建。
 */

export const BACKUP_APP = "financial";
export const BACKUP_VERSION = 1;
/** 上傳檔案大小上限 */
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

const id = z.string().min(1);
const nullableId = id.nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式應為 YYYY-MM-DD");
const optionalTimestamp = z.string().optional();
const money = z.number().finite();

const ledgerSchema = z.object({
  name: z.string(),
  start_date: date,
  cover_color: z.string().nullable().optional(),
  cover_material: z.string().nullable().optional(),
  monthly_spending_limit: money.nonnegative().nullable().optional(),
});

const profileSchema = z
  .object({
    display_name: z.string().nullable().optional(),
    slogan: z.string().nullable().optional(),
    animations_enabled: z.boolean().optional(),
  })
  .nullable()
  .optional();

const accountSchema = z.object({
  id,
  name: z.string().min(1),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  subtype: z.string().nullable(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  is_system: z.boolean(),
  is_archived: z.boolean(),
  sort_order: z.number().int(),
  parent_id: nullableId,
  monthly_budget: money.nonnegative().nullable().optional(),
  created_at: optionalTimestamp,
});

const entrySchema = z.object({
  id,
  kind: z.enum(["income", "expense", "transfer", "opening", "adjustment"]),
  entry_date: date,
  amount: money.positive(),
  from_account_id: nullableId,
  to_account_id: nullableId,
  category_id: nullableId,
  memo: z.string().nullable(),
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
});

const lineSchema = z.object({
  entry_id: id,
  account_id: id,
  debit: money.nonnegative(),
  credit: money.nonnegative(),
});

const budgetSchema = z.object({
  category_id: id,
  month: date,
  amount: money.nonnegative(),
  created_at: optionalTimestamp,
});

const goalSchema = z.object({
  id,
  name: z.string().min(1),
  target_amount: money.positive(),
  target_date: date.nullable(),
  account_id: nullableId,
  note: z.string().nullable(),
  is_archived: z.boolean(),
  achieved_at: date.nullable(),
  sort_order: z.number().int(),
  created_at: optionalTimestamp,
});

const depositSchema = z.object({
  goal_id: id,
  amount: money.positive(),
  deposit_date: date,
  note: z.string().nullable(),
  created_at: optionalTimestamp,
});

const recurringRuleSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["expense", "income", "transfer"]),
  amount: money.positive(),
  amount_varies: z.boolean().optional(),
  from_account_id: nullableId,
  to_account_id: nullableId,
  category_id: nullableId,
  memo: z.string().nullable(),
  frequency: z.enum(["monthly", "weekly", "yearly"]),
  day_of_month: z.number().int().nullable(),
  weekday: z.number().int().nullable(),
  month_of_year: z.number().int().nullable(),
  next_date: date,
  is_active: z.boolean().optional(),
  created_at: optionalTimestamp,
});

const categoryRuleSchema = z.object({
  pattern: z.string().min(1),
  category_id: id,
  account_id: nullableId,
  sort_order: z.number().int().optional(),
  created_at: optionalTimestamp,
});

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.literal(BACKUP_VERSION),
  exported_at: z.string(),
  ledger: ledgerSchema,
  profile: profileSchema,
  accounts: z.array(accountSchema),
  entries: z.array(entrySchema),
  entry_lines: z.array(lineSchema),
  budgets: z.array(budgetSchema),
  goals: z.array(goalSchema),
  goal_deposits: z.array(depositSchema),
  // 里程碑 7 起才有；舊備份沒有就當作空的
  recurring_rules: z.array(recurringRuleSchema).default([]),
  category_rules: z.array(categoryRuleSchema).default([]),
});

export type Backup = z.infer<typeof backupSchema>;

export interface BackupSummary {
  ledgerName: string;
  exportedAt: string;
  /** 資產＋負債 */
  accountCount: number;
  /** 收入＋費用 */
  categoryCount: number;
  entryCount: number;
  /** 不含期初餘額的交易日期範圍；沒有交易時為 null */
  firstDate: string | null;
  lastDate: string | null;
  budgetCount: number;
  goalCount: number;
  depositCount: number;
  recurringCount: number;
  categoryRuleCount: number;
}

export type ParseResult = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// 匯出
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** 去掉每列都一樣、還原時會重新指定的欄位 */
function strip<T extends Row>(rows: T[], keys: string[]): Row[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key))));
}

export interface BackupParts {
  ledger: Row;
  profile: Row | null;
  accounts: Row[];
  entries: Row[];
  entry_lines: Row[];
  budgets: Row[];
  goals: Row[];
  goal_deposits: Row[];
  recurring_rules?: Row[];
  category_rules?: Row[];
}

/** 組成要下載的備份物件（欄位順序固定，方便人看） */
export function buildBackup(parts: BackupParts, exportedAt: Date = new Date()) {
  const { ledger, profile } = parts;
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: exportedAt.toISOString(),
    ledger: {
      name: ledger.name,
      start_date: ledger.start_date,
      cover_color: ledger.cover_color ?? null,
      cover_material: ledger.cover_material ?? null,
      monthly_spending_limit: ledger.monthly_spending_limit ?? null,
    },
    profile: profile
      ? { display_name: profile.display_name ?? null, slogan: profile.slogan ?? null, animations_enabled: profile.animations_enabled ?? true }
      : null,
    accounts: strip(parts.accounts, ["ledger_id"]),
    entries: strip(parts.entries, ["ledger_id", "created_by"]),
    entry_lines: strip(parts.entry_lines, ["ledger_id", "id"]),
    budgets: strip(parts.budgets, ["ledger_id", "id"]),
    goals: strip(parts.goals, ["ledger_id"]),
    goal_deposits: strip(parts.goal_deposits, ["ledger_id", "id"]),
    recurring_rules: strip(parts.recurring_rules ?? [], ["ledger_id", "id"]),
    category_rules: strip(parts.category_rules ?? [], ["ledger_id", "id"]),
  };
}

/** 帳本備份-YYYY-MM-DD.json（用本地日期） */
export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `帳本備份-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

// ---------------------------------------------------------------------------
// 驗證
// ---------------------------------------------------------------------------

const cents = (n: number) => Math.round(n * 100);

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length > 0 ? `（${issue.path.join(".")}）` : "";
  return `備份檔格式不正確${path}`;
}

/** 解析上傳的文字並逐項檢查；任何一項不過就回傳一句可以給使用者看的原因 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "這不是 JSON 檔，請選擇從「下載備份」得到的檔案" };
  }
  if (typeof raw !== "object" || raw === null || (raw as Row).app !== BACKUP_APP) {
    return { ok: false, error: "這不是本 App 的備份檔" };
  }
  if ((raw as Row).version !== BACKUP_VERSION) {
    return { ok: false, error: `不支援的備份版本（${String((raw as Row).version)}），請用最新版的 App 重新下載備份` };
  }

  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const backup = parsed.data;

  const accountIds = new Set(backup.accounts.map((a) => a.id));
  const entryIds = new Set(backup.entries.map((e) => e.id));
  const goalIds = new Set(backup.goals.map((g) => g.id));
  if (accountIds.size !== backup.accounts.length || entryIds.size !== backup.entries.length || goalIds.size !== backup.goals.length) {
    return { ok: false, error: "備份檔裡有重複的 id" };
  }

  const openingAccounts = backup.accounts.filter((a) => a.type === "equity" && a.subtype === "opening_balance");
  if (openingAccounts.length !== 1) return { ok: false, error: "備份檔缺少「期初餘額」科目" };

  const accountById = new Map(backup.accounts.map((a) => [a.id, a]));
  const missing = (ref: string | null) => ref !== null && !accountIds.has(ref);
  if (backup.accounts.some((a) => missing(a.parent_id))) return { ok: false, error: "備份檔裡有類別的上層類別不存在" };
  if (backup.entries.some((e) => missing(e.from_account_id) || missing(e.to_account_id) || missing(e.category_id))) {
    return { ok: false, error: "備份檔裡有交易指到不存在的帳戶或類別" };
  }
  if (backup.entry_lines.some((l) => !entryIds.has(l.entry_id) || !accountIds.has(l.account_id))) {
    return { ok: false, error: "備份檔裡有分錄指到不存在的交易或科目" };
  }
  if (backup.budgets.some((b) => accountById.get(b.category_id)?.type !== "expense")) {
    return { ok: false, error: "備份檔裡有預算指到不存在的費用類別" };
  }
  if (backup.goals.some((g) => g.account_id !== null && accountById.get(g.account_id)?.type !== "asset")) {
    return { ok: false, error: "備份檔裡有目標綁到不存在的帳戶" };
  }
  if (backup.goal_deposits.some((d) => !goalIds.has(d.goal_id))) return { ok: false, error: "備份檔裡有存入紀錄指到不存在的目標" };
  if (backup.recurring_rules.some((r) => missing(r.from_account_id) || missing(r.to_account_id) || missing(r.category_id))) {
    return { ok: false, error: "備份檔裡有固定支出指到不存在的帳戶或類別" };
  }
  if (backup.category_rules.some((r) => !accountIds.has(r.category_id) || missing(r.account_id))) {
    return { ok: false, error: "備份檔裡有分類規則指到不存在的帳戶或類別" };
  }

  // 每筆交易至少兩行分錄、每行只有借或貸、借貸相等
  const totals = new Map<string, { debit: number; credit: number; count: number }>();
  for (const line of backup.entry_lines) {
    if ((line.debit > 0) === (line.credit > 0)) return { ok: false, error: "備份檔裡有分錄同時有借貸或金額為 0" };
    const t = totals.get(line.entry_id) ?? { debit: 0, credit: 0, count: 0 };
    t.debit += cents(line.debit);
    t.credit += cents(line.credit);
    t.count += 1;
    totals.set(line.entry_id, t);
  }
  for (const entry of backup.entries) {
    const t = totals.get(entry.id);
    if (!t || t.count < 2 || t.debit !== t.credit) {
      return { ok: false, error: `備份檔裡有借貸不平衡的交易（${entry.entry_date}${entry.memo ? `「${entry.memo}」` : ""}）` };
    }
  }

  return { ok: true, backup, summary: summarize(backup) };
}

export function summarize(backup: Backup): BackupSummary {
  const dated = backup.entries
    .filter((e) => e.kind !== "opening")
    .map((e) => e.entry_date)
    .sort();
  return {
    ledgerName: backup.ledger.name,
    exportedAt: backup.exported_at,
    accountCount: backup.accounts.filter((a) => a.type === "asset" || a.type === "liability").length,
    categoryCount: backup.accounts.filter((a) => a.type === "revenue" || a.type === "expense").length,
    entryCount: backup.entries.length,
    firstDate: dated[0] ?? null,
    lastDate: dated.at(-1) ?? null,
    budgetCount: backup.budgets.length,
    goalCount: backup.goals.length,
    depositCount: backup.goal_deposits.length,
    recurringCount: backup.recurring_rules.length,
    categoryRuleCount: backup.category_rules.length,
  };
}
