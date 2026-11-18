import { expect, test } from "@playwright/test";

test("報表：六種期間切換、三張報表上方的圖", async ({ page }) => {
  await page.goto("/reports");
  const periods = page.getByRole("radiogroup", { name: "期間長度" });
  const presets: [string, string][] = [
    ["日", "day"],
    ["週", "week"],
    ["月", "month"],
    ["季", "quarter"],
    ["自訂", "custom"],
    ["年", "year"],
  ];
  for (const [label, preset] of presets) {
    const radio = periods.getByRole("radio", { name: label, exact: true });
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true");
    await expect(page).toHaveURL(new RegExp(`preset=${preset}`));
  }
  // 自訂會出現起迄日
  await periods.getByRole("radio", { name: "自訂", exact: true }).click();
  await expect(page.getByLabel("起日")).toBeVisible();
  await expect(page.getByLabel("迄日")).toBeVisible();

  // 用「年」看圖（測試帳號今年有收入與支出）
  await periods.getByRole("radio", { name: "年", exact: true }).click();

  await page.getByRole("tab", { name: "損益表" }).click();
  const monthlyBars = page.getByRole("img", { name: /每月收入與支出長條圖/ });
  await expect(monthlyBars).toBeVisible();
  await expect(monthlyBars.locator("svg.recharts-surface")).toBeVisible();
  await expect(page.getByRole("img", { name: /^支出類別占比/ })).toBeVisible();

  await page.getByRole("tab", { name: "資產負債表" }).click();
  await expect(page).toHaveURL(/tab=balance/);
  await expect(page.getByRole("img", { name: /^淨值走勢/ }).locator("svg.recharts-surface")).toBeVisible();

  await page.getByRole("tab", { name: "現金流量表" }).click();
  await expect(page).toHaveURL(/tab=cashflow/);
  await expect(page.getByRole("img", { name: /營業、投資、融資三類活動的現金流入與流出長條圖/ }).locator("svg.recharts-surface")).toBeVisible();
});
