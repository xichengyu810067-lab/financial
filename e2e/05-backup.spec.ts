import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("設定頁下載備份：檔名與 JSON 內容", async ({ page }) => {
  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下載備份" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^帳本備份-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByText(/已下載備份（\d+ 筆交易）/)).toBeVisible();

  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(backup).toMatchObject({ app: "financial", version: 1 });
  expect(Object.keys(backup)).toEqual(["app", "version", "exported_at", "ledger", "profile", "accounts", "entries", "entry_lines", "budgets", "goals", "goal_deposits", "recurring_rules", "category_rules"]);
  expect(backup.entries.length).toBeGreaterThan(0);
  expect(JSON.stringify(backup)).not.toContain("ledger_id");
  expect(backup.accounts.some((a: { subtype: string }) => a.subtype === "opening_balance")).toBe(true);

  // 每筆交易借貸平衡
  const net = new Map<string, number>();
  for (const line of backup.entry_lines as { entry_id: string; debit: number; credit: number }[]) {
    net.set(line.entry_id, (net.get(line.entry_id) ?? 0) + Math.round(line.debit * 100) - Math.round(line.credit * 100));
  }
  expect(net.size).toBe(backup.entries.length);
  expect([...net.values()].every((v) => v === 0)).toBe(true);
});
