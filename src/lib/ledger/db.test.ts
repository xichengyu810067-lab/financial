import { describe, expect, it } from "vitest";
import { fetchAllRows, PAGE_SIZE, throwIfFailed, unwrap, unwrapOne, unwrapRows, withNumericAmount } from "./db";

/** 模擬 PostgREST：一次最多回 PAGE_SIZE 列 */
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i, amount: "1.50" }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + PAGE_SIZE)), error: null };
  };
  return { page, calls };
}

describe("fetchAllRows", () => {
  it("超過 1000 列時分頁抓完，不重複、不漏", async () => {
    const { page, calls } = fakeTable(2345);
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(2345);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2345);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    // 明細合計：每筆 1.5，總和要等於 2345 × 1.5（以前只會算到前 1000 筆）
    expect(rows.map(withNumericAmount).reduce((s, r) => s + r.amount, 0)).toBe(3517.5);
  });

  it("剛好 1000 列時多問一頁確認沒有了", async () => {
    const { page, calls } = fakeTable(1000);
    expect(await fetchAllRows(page)).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });

  it("沒有資料回空陣列；任何一頁出錯就丟出", async () => {
    expect(await fetchAllRows(async () => ({ data: null, error: null }))).toEqual([]);
    let n = 0;
    const failing = async () => (n++ === 0 ? { data: Array(PAGE_SIZE).fill({}), error: null } : { data: null, error: { message: "timeout" } });
    await expect(fetchAllRows(failing)).rejects.toThrow("timeout");
  });
});

describe("unwrap", () => {
  it("有錯丟出、沒錯回傳資料", () => {
    expect(unwrap({ data: 1, error: null })).toBe(1);
    expect(() => unwrap({ data: null, error: { message: "permission denied" } })).toThrow("permission denied");
    expect(unwrapRows({ data: null, error: null })).toEqual([]);
    expect(unwrapOne({ data: { id: "a" }, error: null })).toEqual({ id: "a" });
    expect(() => unwrapOne({ data: null, error: null }, "建立失敗")).toThrow("建立失敗");
  });
});

describe("throwIfFailed", () => {
  const boom = new Error("連線失敗");

  it("載入失敗而且沒有舊資料才丟出", () => {
    expect(() => throwIfFailed({ error: null, data: undefined }, { error: boom, data: undefined })).toThrow(boom);
  });

  it("還在載入、或背景重抓失敗但畫面上有舊資料時不丟", () => {
    expect(() => throwIfFailed({ error: null, data: undefined })).not.toThrow();
    expect(() => throwIfFailed({ error: boom, data: [] })).not.toThrow();
    expect(() => throwIfFailed({ error: boom, data: null })).not.toThrow();
  });
});
