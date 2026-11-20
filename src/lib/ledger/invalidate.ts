import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { keys } from "./keys";

/**
 * 寫入之後要刷新哪些查詢：一張對照表，帳本資料的 mutation 都從這裡走
 * （個人資料只有 keys.profile 一個鍵，直接刷新）。
 * 新增一種寫入時先想它會影響哪些畫面，再加到表裡（並補 invalidate.test.ts）。
 */
export type WriteKind =
  /** 新增、修改、刪除交易 */
  | "entry"
  /** 科目：新增、修改、封存、刪除、排序、期初餘額 */
  | "account"
  /** 帳本設定（名稱、起始日、封面、每月上限） */
  | "ledger"
  /** 目標、存入、達標日 */
  | "goal"
  /** 當月預算覆寫 */
  | "budget"
  /** 掃描、匯入、略過待確認項目（不產生交易） */
  | "inboxItem"
  /** 確認待確認項目（會產生交易、更新店家記憶） */
  | "inboxConfirm"
  /** 固定支出 */
  | "recurring"
  /** 自動分類規則 */
  | "categoryRule";

/** 交易一變，餘額、期初、報表、交易列表都要重算 */
const entryData = (ledgerId: string): QueryKey[] => [
  keys.entries.all(ledgerId),
  keys.balances(ledgerId),
  keys.openings(ledgerId),
  keys.reports.all(ledgerId),
];

export function affectedKeys(kind: WriteKind, ledgerId: string): QueryKey[] {
  switch (kind) {
    case "entry":
      return entryData(ledgerId);
    case "account":
      // 刪科目會連帶刪掉綁它的固定支出與分類規則、清空待確認項目上的帳戶（外鍵 cascade／set null）
      return [keys.accounts(ledgerId), ...entryData(ledgerId), keys.inbox.all(ledgerId)];
    case "ledger":
      // 改起始日會連期初交易的日期一起改
      return [keys.ledger, ...entryData(ledgerId)];
    case "goal":
    case "budget":
      return [keys.reports.all(ledgerId)];
    case "inboxItem":
      return [keys.inbox.pending(ledgerId)];
    case "inboxConfirm":
      return [keys.inbox.all(ledgerId), ...entryData(ledgerId)];
    case "recurring":
      return [keys.inbox.all(ledgerId)];
    case "categoryRule":
      return [keys.inbox.rules(ledgerId)];
  }
}

export async function invalidateAfter(queryClient: QueryClient, kind: WriteKind, ledgerId: string): Promise<void> {
  await Promise.all(affectedKeys(kind, ledgerId).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
