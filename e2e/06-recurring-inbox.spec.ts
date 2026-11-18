import { expect, test } from "@playwright/test";
import { E2E } from "./support";

const SHOTS = process.env.E2E_SCREENSHOTS;

test("固定支出 → 到期進待確認匣 → 改金額確認入帳 → 刪除規則", async ({ page }) => {
  const name = `${E2E} 房租 ${Date.now().toString().slice(-4)}`;
  const toasts = page.getByRole("region", { name: /Notifications/ });

  // 新增：每月今天這一號，第一次就是今天
  await page.goto("/recurring");
  await page.getByRole("button", { name: "新增固定支出" }).click();
  const dialog = page.getByRole("dialog", { name: "新增固定支出" });
  await dialog.getByLabel("名稱").fill(name);
  await dialog.getByLabel("金額", { exact: true }).fill("12000");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("combobox", { name: "付款帳戶" }).click();
  await page.getByRole("option", { name: /^現金/ }).click();
  await dialog.getByRole("combobox", { name: "類別" }).click();
  await page.getByRole("option", { name: "居住", exact: true }).click();
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(dialog.getByLabel("第一次日期")).toHaveValue(today);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/recurring-dialog.png` });
  await dialog.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(dialog).toBeHidden();
  const ruleRow = page.getByRole("listitem").filter({ hasText: name });
  await expect(ruleRow).toContainText(`下次 ${today}`);

  // 今天這一頁出現提醒 → 待確認匣
  await page.goto("/today");
  const banner = page.getByRole("link", { name: /筆待確認/ });
  await expect(banner).toBeVisible();
  await banner.click();
  await expect(page).toHaveURL(/\/inbox$/);
  const item = page.getByRole("listitem").filter({ hasText: name });
  await expect(item).toContainText("−$12,000");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/inbox.png`, fullPage: true });

  // 這期金額不一樣：改成 12500 再確認
  await item.getByRole("button", { name: `修改「${name}」` }).click();
  const confirm = page.getByRole("dialog", { name: `確認「${name}」` });
  await confirm.getByLabel("金額", { exact: true }).fill("12500");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/inbox-confirm.png` });
  await confirm.getByRole("button", { name: "確認入帳" }).click();
  await expect(toasts.getByText("已入帳")).toBeVisible();
  await expect(item).toHaveCount(0);

  // 交易清單看得到，下次日期往後推
  await page.goto("/transactions");
  await expect(page.getByRole("button", { name: /居住 −\$12,500/ }).filter({ hasText: name })).toBeVisible();
  await page.goto("/recurring");
  await expect(ruleRow).not.toContainText(`下次 ${today}`);

  // 刪除規則
  await ruleRow.getByRole("button", { name: `刪除「${name}」` }).click();
  await page.getByRole("dialog", { name: `刪除「${name}」？` }).getByRole("button", { name: "刪除", exact: true }).click();
  await expect(toasts.getByText(`已刪除「${name}」`)).toBeVisible();
  await expect(ruleRow).toHaveCount(0);
});

test("自動分類規則：新增與刪除", async ({ page }) => {
  const pattern = `${E2E}全家${Date.now().toString().slice(-3)}`;
  const toasts = page.getByRole("region", { name: /Notifications/ });

  await page.goto("/settings");
  const card = page.locator("form", { has: page.getByLabel("店名包含") });
  await card.getByLabel("店名包含").fill(pattern);
  await card.getByRole("combobox", { name: "類別" }).click();
  await page.getByRole("option", { name: "飲食", exact: true }).click();
  await card.getByRole("button", { name: "新增規則" }).click();
  await expect(toasts.getByText(`已新增規則「${pattern}」`)).toBeVisible();
  await expect(page.getByText(`店名包含「${pattern}」→ 飲食`)).toBeVisible();

  await page.getByRole("button", { name: `刪除規則「${pattern}」` }).click();
  await expect(toasts.getByText(`已刪除規則「${pattern}」`)).toBeVisible();
  await expect(page.getByText(`店名包含「${pattern}」`)).toHaveCount(0);
});
