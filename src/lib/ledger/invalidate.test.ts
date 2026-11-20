import { describe, expect, it } from "vitest";
import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { affectedKeys, invalidateAfter, type WriteKind } from "./invalidate";
import { keys } from "./keys";

const L = "ledger-1";

/** 某次寫入後，這個查詢鍵會不會被刷新（前綴比對，跟 TanStack Query 的規則一樣） */
function refreshes(kind: WriteKind, key: QueryKey): boolean {
  return affectedKeys(kind, L).some((prefix) => prefix.every((part, i) => key[i] === part));
}

describe("affectedKeys", () => {
  it("記帳後：交易列表、明細、餘額、期初、報表、一天一頁、目標進度都重算；待確認匣不動", () => {
    for (const key of [
      keys.entries.month(L, "2026-11"),
      keys.entries.range(L, "2026-01-01", "2026-12-31"),
      keys.balances(L),
      keys.openings(L),
      keys.reports.income(L, "2026-11-01", "2026-11-30"),
      keys.reports.daily(L, "2026-11-01", "2026-11-30"),
      keys.reports.goals(L, "2026-11-20"),
      keys.reports.netWorth(L, "2025-12-01", "2026-11-30"),
    ]) {
      expect(refreshes("entry", key), JSON.stringify(key)).toBe(true);
    }
    expect(refreshes("entry", keys.inbox.pending(L))).toBe(false);
    expect(refreshes("entry", keys.accounts(L))).toBe(false);
  });

  it("刪科目：待確認匣、固定支出、分類規則也要刷新（外鍵會連帶刪除或清空）", () => {
    expect(refreshes("account", keys.inbox.pending(L))).toBe(true);
    expect(refreshes("account", keys.inbox.recurring(L))).toBe(true);
    expect(refreshes("account", keys.inbox.rules(L))).toBe(true);
    expect(refreshes("account", keys.accounts(L))).toBe(true);
    expect(refreshes("account", keys.reports.balance(L, "2026-11-20"))).toBe(true);
  });

  it("改帳本起始日：期初交易的日期會跟著動", () => {
    expect(refreshes("ledger", keys.ledger)).toBe(true);
    expect(refreshes("ledger", keys.openings(L))).toBe(true);
    expect(refreshes("ledger", keys.reports.balance(L, "2026-11-20"))).toBe(true);
  });

  it("確認待確認項目：待確認匣與交易相關的全部刷新", () => {
    expect(refreshes("inboxConfirm", keys.inbox.pending(L))).toBe(true);
    expect(refreshes("inboxConfirm", keys.entries.month(L, "2026-11"))).toBe(true);
    expect(refreshes("inboxConfirm", keys.reports.categoryStats(L, "2026-11-20"))).toBe(true);
  });

  it("只影響自己範圍的寫入", () => {
    expect(refreshes("inboxItem", keys.inbox.pending(L))).toBe(true);
    expect(refreshes("inboxItem", keys.entries.all(L))).toBe(false);
    expect(refreshes("categoryRule", keys.inbox.rules(L))).toBe(true);
    expect(refreshes("categoryRule", keys.inbox.pending(L))).toBe(false);
    expect(refreshes("recurring", keys.inbox.pending(L))).toBe(true);
    expect(refreshes("goal", keys.reports.goals(L, "2026-11-20"))).toBe(true);
    expect(refreshes("budget", keys.reports.categoryStats(L, "2026-11-20"))).toBe(true);
    expect(refreshes("budget", keys.entries.all(L))).toBe(false);
  });

  it("不會動到別本帳本", () => {
    const kinds: WriteKind[] = ["entry", "account", "ledger", "goal", "budget", "inboxItem", "inboxConfirm", "recurring", "categoryRule"];
    for (const kind of kinds) {
      expect(affectedKeys(kind, L).some((key) => key.includes("ledger-2"))).toBe(false);
    }
  });
});

describe("invalidateAfter", () => {
  it("把對應的查詢標成過期", async () => {
    const client = new QueryClient();
    client.setQueryData(keys.inbox.pending(L), []);
    client.setQueryData(keys.entries.month(L, "2026-11"), []);
    await invalidateAfter(client, "account", L);
    expect(client.getQueryState(keys.inbox.pending(L))?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.entries.month(L, "2026-11"))?.isInvalidated).toBe(true);
  });
});
