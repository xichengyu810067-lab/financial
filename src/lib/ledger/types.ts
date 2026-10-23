import type { Database, Tables } from "@/lib/supabase/database.types";

export type Ledger = Tables<"ledgers">;
export type Profile = Tables<"profiles">;
export type Account = Tables<"accounts">;
export type AccountBalance = Tables<"account_balances">;
export type AccountType = Database["public"]["Enums"]["account_type"];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "資產",
  liability: "負債",
  equity: "權益",
  revenue: "收入",
  expense: "費用",
};

/** 帳戶（資產／負債）的子類型，供表單選擇與列表標籤 */
export const SUBTYPES: { value: string; label: string; type: "asset" | "liability" }[] = [
  { value: "cash", label: "現金", type: "asset" },
  { value: "bank", label: "銀行", type: "asset" },
  { value: "ewallet", label: "電子支付", type: "asset" },
  { value: "investment", label: "投資", type: "asset" },
  { value: "other_asset", label: "其他資產", type: "asset" },
  { value: "credit_card", label: "信用卡", type: "liability" },
  { value: "loan", label: "貸款", type: "liability" },
  { value: "other_liability", label: "其他負債", type: "liability" },
];

export function subtypeLabel(value: string | null | undefined): string | null {
  return SUBTYPES.find((s) => s.value === value)?.label ?? null;
}

/** 資產或負債 = 使用者看到的「帳戶」 */
export function isBalanceAccount(a: Pick<Account, "type">): boolean {
  return a.type === "asset" || a.type === "liability";
}

/** 收入或費用 = 使用者看到的「類別」 */
export function isCategory(a: Pick<Account, "type">): boolean {
  return a.type === "revenue" || a.type === "expense";
}
