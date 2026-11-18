import type { Tables } from "@/lib/supabase/database.types";
import { toCents } from "./posting";

/**
 * 待確認匣（里程碑 7）：確認面板的拆分、檢查與送出內容都是純函式，方便單元測試。
 * 資料庫的 confirm_inbox_item 會再檢查一次並在同一個交易裡建立交易。
 */

export type InboxItem = Tables<"inbox_items">;
export type InboxSource = "recurring" | "invoice_qr" | "invoice_csv";

export const SOURCE_LABELS: Record<InboxSource, string> = {
  recurring: "固定支出",
  invoice_qr: "掃描發票",
  invoice_csv: "載具匯入",
};

/** 發票上的品項（PR B／C 寫入 items） */
export interface InvoiceLine {
  name: string;
  qty: number;
  price: number;
}

export interface Split {
  categoryId: string;
  /** 表單上的文字，送出前才轉數字 */
  amount: string;
  memo: string;
}

export interface ConfirmDraft {
  date: string;
  fromAccountId: string;
  toAccountId: string;
  splits: Split[];
}

export const isInvoice = (item: Pick<InboxItem, "source">) => item.source !== "recurring";

/** 帳戶與類別都有了，可以不打開面板直接確認（批次確認用） */
export function isReady(item: Pick<InboxItem, "kind" | "from_account_id" | "to_account_id" | "category_id">): boolean {
  switch (item.kind) {
    case "expense":
      return Boolean(item.from_account_id && item.category_id);
    case "income":
      return Boolean(item.to_account_id && item.category_id);
    case "transfer":
      return Boolean(item.from_account_id && item.to_account_id);
    default:
      return false;
  }
}

/** 發票品項（數量 × 單價），讀不到就是空陣列 */
export function invoiceLines(item: Pick<InboxItem, "items">): InvoiceLine[] {
  if (!Array.isArray(item.items)) return [];
  return item.items.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const { name, qty, price } = raw as Record<string, unknown>;
    if (typeof name !== "string" || typeof qty !== "number" || typeof price !== "number") return [];
    return [{ name, qty, price }];
  });
}

const amountText = (n: number) => String(Math.round(n * 100) / 100);

/** 預設一筆：整張的金額、建議的類別 */
export function initialDraft(item: InboxItem): ConfirmDraft {
  return {
    date: item.entry_date,
    fromAccountId: item.from_account_id ?? "",
    toAccountId: item.to_account_id ?? "",
    splits: [{ categoryId: item.category_id ?? "", amount: amountText(Number(item.amount)), memo: "" }],
  };
}

/** 依發票品項拆開：每個品項一筆，類別先沿用建議的類別 */
export function splitsFromInvoice(item: InboxItem): Split[] {
  const lines = invoiceLines(item);
  if (lines.length < 2) return initialDraft(item).splits;
  return lines.map((line) => ({
    categoryId: item.category_id ?? "",
    amount: amountText(line.qty * line.price),
    memo: line.qty === 1 ? line.name : `${line.name} ×${line.qty}`,
  }));
}

export function splitsTotal(splits: Split[]): number {
  return splits.reduce((sum, s) => sum + toCents(Number(s.amount) || 0), 0) / 100;
}

/** 檢查確認面板的內容；沒問題回傳 null，否則回傳一句給使用者看的原因 */
export function validateDraft(item: InboxItem, draft: ConfirmDraft): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "請選擇日期";
  if ((item.kind === "expense" || item.kind === "transfer") && !draft.fromAccountId) return item.kind === "transfer" ? "請選擇轉出帳戶" : "請選擇付款帳戶";
  if ((item.kind === "income" || item.kind === "transfer") && !draft.toAccountId) return item.kind === "transfer" ? "請選擇轉入帳戶" : "請選擇存入帳戶";
  if (item.kind === "transfer" && draft.fromAccountId === draft.toAccountId) return "轉出與轉入帳戶不能相同";
  if (draft.splits.length === 0) return "至少要有一筆";
  if (item.kind === "transfer" && draft.splits.length > 1) return "轉帳不能拆成多筆";
  for (const split of draft.splits) {
    const amount = Number(split.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "每一筆的金額都要大於 0";
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return "金額最多兩位小數";
    if (item.kind !== "transfer" && !split.categoryId) return draft.splits.length > 1 ? "每一筆都要選類別" : "請選擇類別";
  }
  if (isInvoice(item) && toCents(splitsTotal(draft.splits)) !== toCents(Number(item.amount))) {
    return `拆開的金額合計要等於發票金額（還差 ${amountText(Number(item.amount) - splitsTotal(draft.splits))}）`;
  }
  return null;
}

/** 送給 confirm_inbox_item 的 p_entry */
export function confirmPayload(item: InboxItem, draft: ConfirmDraft) {
  return {
    entry_date: draft.date,
    from_account_id: item.kind === "income" ? null : draft.fromAccountId || null,
    to_account_id: item.kind === "expense" ? null : draft.toAccountId || null,
    splits: draft.splits.map((s) => ({
      category_id: item.kind === "transfer" ? null : s.categoryId,
      amount: Number(s.amount),
      memo: s.memo.trim() || null,
    })),
  };
}

/** 批次確認：直接用項目上的帳戶、類別與金額 */
export function payloadAsIs(item: InboxItem) {
  return confirmPayload(item, initialDraft(item));
}

/** 列表上顯示的標題：店名或備註 */
export function inboxTitle(item: Pick<InboxItem, "merchant_name" | "memo" | "source">): string {
  return item.merchant_name ?? item.memo ?? SOURCE_LABELS[item.source as InboxSource] ?? "待確認";
}
