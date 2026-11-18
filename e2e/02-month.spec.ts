import { expect, test } from "@playwright/test";

test("本月頁「還能花」跟著每月總支出上限變，類別可以改這個月的額度", async ({ page }) => {
  // 設定頁改每月總支出上限（teardown 會還原成跑之前的值）
  await page.goto("/settings");
  const ledgerForm = page.locator("form", { has: page.getByLabel("每月總支出上限") });
  await ledgerForm.getByLabel("每月總支出上限").fill("12345");
  await ledgerForm.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(page.getByText("已儲存帳本設定")).toBeVisible();

  await page.goto("/month");
  const hero = page.getByRole("region", { name: "這個月還能花" });
  await expect(hero).toBeVisible();
  await expect(hero).toContainText("總預算 $12,345");

  // 購物這個月的額度改成 4500（寫 budgets，teardown 刪掉這次新增的列）
  const collapsed = page.getByRole("button", { name: /都在範圍內/ });
  if (await collapsed.isVisible()) await collapsed.click();
  await page.getByRole("button", { name: "改 購物 這個月的額度" }).click();
  await page.getByRole("textbox", { name: "購物 這個月的額度" }).fill("4500");
  await page.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(page.getByText("這個月 購物 的額度設為 $4,500")).toBeVisible();
});
