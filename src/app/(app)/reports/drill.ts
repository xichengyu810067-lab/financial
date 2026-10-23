import type { Entry } from "@/lib/ledger/entries";
import type { Period } from "@/lib/ledger/period";
import { round2 } from "@/lib/ledger/report-model";
import type { AccountType } from "@/lib/ledger/types";

/**
 * 下鑽（明細面板）的請求：三張報表點某一列時，告訴面板要列哪些交易、底部怎麼合計。
 * 面板只抓一次期間內的交易，篩選與合計都在前端做。
 */

export interface SummaryItem {
  label: string;
  value: number;
  tone?: "income" | "expense" | "none";
}

export interface DetailRequest {
  title: string;
  subtitle: string;
  period: Period;
  match: (entry: Entry) => boolean;
  summarize: (entries: Entry[]) => SummaryItem[];
}

export const sumAmounts = (entries: Entry[]) => round2(entries.reduce((s, e) => s + Number(e.amount), 0));

/**
 * 某筆交易讓某個帳戶的餘額（依正常餘額方向）變動多少。
 * 資產：轉入／存入為正、轉出／付款為負；負債：刷卡為正、還款為負；期初餘額一律為正。
 */
export function accountDelta(entry: Entry, accountId: string, type: AccountType): number {
  const amount = Number(entry.amount);
  if (entry.kind === "opening") return entry.to_account_id === accountId ? amount : 0;
  const isDebit = entry.to_account_id === accountId;
  const isCredit = entry.from_account_id === accountId;
  if (!isDebit && !isCredit) return 0;
  const debitPositive = type === "asset" || type === "expense";
  return (isDebit ? amount : -amount) * (debitPositive ? 1 : -1);
}

/** 某筆交易讓「現金及等價物」合計變動多少（cashIds = 現金類帳戶） */
export function cashDelta(entry: Entry, cashIds: ReadonlySet<string>): number {
  const amount = Number(entry.amount);
  const toCash = entry.to_account_id !== null && cashIds.has(entry.to_account_id);
  const fromCash = entry.from_account_id !== null && cashIds.has(entry.from_account_id);
  switch (entry.kind) {
    case "opening":
    case "income":
      return toCash ? amount : 0;
    case "expense":
      return fromCash ? -amount : 0;
    default:
      return (toCash ? amount : 0) - (fromCash ? amount : 0);
  }
}

/** 把一組變動量整理成「增加／減少／淨變動」三列 */
export function summarizeDeltas(deltas: number[], labels: { up: string; down: string }): SummaryItem[] {
  const up = round2(deltas.filter((d) => d > 0).reduce((s, d) => s + d, 0));
  const down = round2(deltas.filter((d) => d < 0).reduce((s, d) => s - d, 0));
  return [
    { label: labels.up, value: up, tone: "income" },
    { label: labels.down, value: down, tone: "expense" },
    { label: "淨變動", value: round2(up - down) },
  ];
}
