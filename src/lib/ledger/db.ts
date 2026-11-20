/**
 * Supabase 回應的共用處理：有錯就丟、分頁抓完、numeric 欄位轉成 number。
 * 沒有 "use client"，純函式，可以單元測試。
 */

interface Result<T> {
  data: T;
  error: { message: string } | null;
}

/** 有錯就丟出，否則回傳 data（可能為 null，例如 maybeSingle） */
export function unwrap<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** 一定要有一列的查詢（single、insert … select）：有錯或沒有資料就丟出 */
export function unwrapOne<T>(result: Result<T>, notFound = "找不到資料"): NonNullable<T> {
  const data = unwrap(result);
  if (data === null || data === undefined) throw new Error(notFound);
  return data;
}

/** 列表查詢：有錯就丟出，null 視為空陣列 */
export function unwrapRows<T>(result: Result<T[] | null>): T[] {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

/** PostgREST 一次最多回 1000 列（Supabase 預設的 max-rows） */
export const PAGE_SIZE = 1000;

/**
 * 分頁抓完所有列。page(from, to) 要回傳第 from～to 列（含兩端），而且排序必須穩定
 * （最後加上 id 之類的唯一欄位），不然換頁時可能重複或漏掉。
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<Result<T[] | null>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const part = unwrapRows(await page(from, from + PAGE_SIZE - 1));
    rows.push(...part);
    if (part.length < PAGE_SIZE) return rows;
  }
}

/** numeric 欄位從 PostgREST 回來可能是字串，amount 統一轉成 number */
export function withNumericAmount<T extends { amount: number | string }>(row: T): T & { amount: number } {
  return { ...row, amount: Number(row.amount) };
}

/**
 * 頁面主要資料載入失敗（自動重試後仍失敗、也沒有舊資料可顯示）時，丟給最近的 error.tsx，
 * 不要一直停在載入骨架。只用在「沒有這份資料整頁就畫不出來」的查詢上。
 */
export function throwIfFailed(...results: { error: Error | null; data: unknown }[]): void {
  for (const r of results) {
    if (r.error && r.data === undefined) throw r.error;
  }
}
