import { expect, test } from "@playwright/test";
import { E2E } from "./support";

test("記一筆支出 → 今天這一頁與交易清單都看得到 → 編輯 → 刪除", async ({ page }) => {
  const memo = `${E2E} 午餐 ${Date.now().toString().slice(-6)}`;

  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "今天的交易" })).toBeVisible();

  // 記一筆：金額用算式 120+35
  await page.getByRole("button", { name: "記一筆", exact: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "記一筆" });
  await expect(sheet.getByRole("radio", { name: "支出" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByLabel("金額").fill("120+35");
  await expect(sheet.getByText("= $155")).toBeVisible();
  await sheet.getByRole("combobox", { name: "付款帳戶" }).click();
  await page.getByRole("option", { name: /^現金/ }).click();
  await sheet.getByRole("combobox", { name: "類別" }).click();
  await page.getByRole("option", { name: "飲食", exact: true }).click();
  await sheet.getByLabel("備註").fill(memo);
  await sheet.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(page.getByText("已記一筆")).toBeVisible();
  await expect(sheet).toBeHidden();

  // 今天這一頁
  const row = page.getByRole("button", { name: new RegExp(memo.replace(/[[\]]/g, "\\$&")) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("−$155");

  // 交易清單
  await page.goto("/transactions");
  await expect(page.getByText(memo)).toBeVisible();

  // 編輯：改成 200
  await page.getByText(memo).click();
  const editSheet = page.getByRole("dialog", { name: "編輯交易" });
  await expect(editSheet.getByLabel("金額")).toHaveValue("155");
  await editSheet.getByLabel("金額").fill("200");
  await editSheet.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(page.getByText("已更新交易")).toBeVisible();
  await expect(page.getByRole("button", { name: /飲食 −\$200/ }).filter({ hasText: memo })).toBeVisible();

  // 刪除
  await page.getByText(memo).click();
  await page.getByRole("dialog", { name: "編輯交易" }).getByRole("button", { name: "刪除", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "刪除這筆交易？" });
  await confirm.getByRole("button", { name: "刪除", exact: true }).click();
  await expect(page.getByText("已刪除交易")).toBeVisible();
  await expect(page.getByText(memo)).toHaveCount(0);
});
