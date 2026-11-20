/**
 * 所有查詢鍵集中在這裡。鍵的前綴就是失效（invalidate）的單位：
 *   ["entries", ledgerId]  交易列表
 *   ["reports", ledgerId]  報表、圖表、一天一頁的統計、目標進度（任何記帳都會影響）
 *   ["inbox", ledgerId]    待確認匣、固定支出、自動分類規則
 * 寫入後要刷新哪些前綴，統一由 ./invalidate 的對照表決定。
 */

export const keys = {
  profile: ["profile"] as const,
  ledger: ["ledger"] as const,
  accounts: (ledgerId: string) => ["accounts", ledgerId] as const,
  balances: (ledgerId: string) => ["balances", ledgerId] as const,
  openings: (ledgerId: string) => ["openings", ledgerId] as const,

  entries: {
    all: (ledgerId: string) => ["entries", ledgerId] as const,
    month: (ledgerId: string, month: string) => ["entries", ledgerId, "month", month] as const,
    range: (ledgerId: string, from: string, to: string) => ["entries", ledgerId, "range", from, to] as const,
  },

  reports: {
    all: (ledgerId: string) => ["reports", ledgerId] as const,
    income: (ledgerId: string, from: string, to: string) => ["reports", ledgerId, "income", from, to] as const,
    balance: (ledgerId: string, asOf: string) => ["reports", ledgerId, "balance", asOf] as const,
    cashflow: (ledgerId: string, from: string, to: string) => ["reports", ledgerId, "cashflow", from, to] as const,
    monthly: (ledgerId: string, from: string, to: string) => ["reports", ledgerId, "monthly", from, to] as const,
    netWorth: (ledgerId: string, from: string, to: string) => ["reports", ledgerId, "net-worth", from, to] as const,
    daily: (ledgerId: string, from: string, to: string) => ["reports", ledgerId, "daily", from, to] as const,
    categoryStats: (ledgerId: string, asOf: string) => ["reports", ledgerId, "category-stats", asOf] as const,
    goals: (ledgerId: string, asOf: string) => ["reports", ledgerId, "goals", asOf] as const,
  },

  inbox: {
    all: (ledgerId: string) => ["inbox", ledgerId] as const,
    pending: (ledgerId: string) => ["inbox", ledgerId, "pending"] as const,
    recurring: (ledgerId: string) => ["inbox", ledgerId, "recurring"] as const,
    rules: (ledgerId: string) => ["inbox", ledgerId, "rules"] as const,
  },
};
