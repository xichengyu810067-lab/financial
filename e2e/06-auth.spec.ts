import { expect, test } from "@playwright/test";
import { testAccount } from "./support";

// 放最後跑：登出會讓這個帳號的 refresh token 失效
test.use({ storageState: { cookies: [], origins: [] } });

test("登入 → 使用者選單 → 登出", async ({ page }) => {
  const account = testAccount();

  await page.goto("/today");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoday/);

  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("密碼").fill(account.password);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);

  await page.getByRole("button", { name: "開發測試" }).click();
  await expect(page.getByRole("menuitem", { name: "設定" })).toBeVisible();
  await expect(page.getByText(account.email)).toBeVisible();
  await page.getByRole("menuitem", { name: "登出" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // 登出後回不去
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login\?next=/);
});
