import { expect, test } from "@playwright/test";
import { E2E } from "./support";

test("儲蓄目標：手動目標存入到達標，再封存", async ({ page }) => {
  const name = `${E2E} 新手機 ${Date.now().toString().slice(-4)}`;

  await page.goto("/today");
  const allGoals = page.getByRole("button", { name: /全部目標/ });
  const firstGoal = page.getByRole("button", { name: "設一個儲蓄目標" });
  await expect(allGoals.or(firstGoal).first()).toBeVisible();
  if (await allGoals.isVisible()) {
    await allGoals.click();
    await page.getByRole("dialog", { name: "全部目標" }).getByRole("button", { name: "新增目標" }).click();
  } else {
    await firstGoal.click();
  }

  const dialog = page.getByRole("dialog", { name: "設一個儲蓄目標" });
  await dialog.getByLabel("目標名稱").fill(name);
  await dialog.getByLabel("目標金額").fill("1000");
  await dialog.getByRole("radio", { name: "手動存入" }).click();
  await dialog.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(page.getByText("已新增目標")).toBeVisible();
  await page.keyboard.press("Escape");

  // 從全部目標面板存入 1000 → 達標
  await page.goto("/today");
  await page.getByRole("button", { name: /全部目標/ }).click();
  const sheet = page.getByRole("dialog", { name: "全部目標" });
  const item = sheet.getByRole("listitem").filter({ hasText: name });
  await item.getByRole("button", { name: "存入", exact: true }).click();
  const deposit = page.getByRole("dialog", { name: `存入「${name}」` });
  await expect(deposit).toContainText("還差 $1,000");
  await deposit.getByLabel("金額").fill("1000");
  await deposit.getByLabel("備註（可留空）").fill(`${E2E} 一次存滿`);
  await deposit.getByRole("button", { name: "存入", exact: true }).click();
  await expect(page.getByText("已存入 $1,000")).toBeVisible();
  await expect(page.getByRole("region", { name: /Notifications/ }).getByText(`${name} 達標！`)).toBeVisible();
  await expect(sheet.getByRole("progressbar", { name: `${name} 進度` })).toHaveAttribute("aria-valuenow", "100");

  // 封存
  await item.getByRole("button", { name: "封存", exact: true }).click();
  await expect(page.getByText(`已封存「${name}」`)).toBeVisible();
  await sheet.getByRole("button", { name: /已封存 \d+ 個/ }).click();
  await expect(sheet.getByText(name)).toBeVisible();
});
