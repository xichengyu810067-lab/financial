import { expect, test } from "@playwright/test";
import { decodeImage, invoicePhoto, invoiceQrTexts } from "./invoice-fixture";
import { E2E } from "./support";

const SHOTS = process.env.E2E_SCREENSHOTS;

test("手機條碼：設定後從使用者選單出示，再清除", async ({ page }) => {
  const toasts = page.getByRole("region", { name: /Notifications/ });
  await page.goto("/settings");
  const input = page.getByLabel("手機條碼");
  await input.fill("/ab+1234");
  await page.locator("form", { has: input }).getByRole("button", { name: "儲存", exact: true }).click();
  await expect(toasts.getByText("已儲存手機條碼")).toBeVisible();

  await page.getByRole("button", { name: "開發測試" }).click();
  await page.getByRole("menuitem", { name: "出示手機條碼" }).click();
  const dialog = page.getByRole("dialog", { name: "手機條碼" });
  await expect(dialog.getByRole("img", { name: "手機條碼 /AB+1234" })).toBeVisible();
  await expect(dialog.locator("svg rect").first()).toBeAttached();
  // 畫出來的 Code 39 真的讀得回 /AB+1234
  const shot = await dialog.getByRole("img", { name: "手機條碼 /AB+1234" }).screenshot();
  expect(await decodeImage(shot)).toContain("/AB+1234");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/carrier.png` });
  await page.keyboard.press("Escape");

  await page.locator("form", { has: input }).getByRole("button", { name: "清除" }).click();
  await expect(toasts.getByText("已清除手機條碼")).toBeVisible();
});

test("掃發票（上傳照片）→ 查到店名 → 依品項拆成三筆入帳；同一張不能再放進來", async ({ page, browser }) => {
  // 22555003 是統一超商的公開統編，用來確認統編查店名
  const qr = invoiceQrTexts("22555003");
  const photo = await invoicePhoto(browser, qr.left, qr.right);
  const toasts = page.getByRole("region", { name: /Notifications/ });

  await page.goto("/scan");
  await expect(page.getByRole("radio", { name: /單張/ })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("上傳發票照片").setInputFiles({ name: "invoice.png", mimeType: "image/png", buffer: photo });

  const dialog = page.getByRole("dialog", { name: "確認「統一超商股份有限公司」" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog).toContainText(qr.invoiceNo);
  await expect(dialog).toContainText("發票品項（3 項）");

  await dialog.getByRole("combobox", { name: "付款帳戶" }).click();
  await page.getByRole("option", { name: /^現金/ }).click();
  await dialog.getByRole("button", { name: "依品項拆開" }).click();
  for (const [i, category] of [
    [1, "購物"],
    [2, "醫療"],
    [3, "飲食"],
  ] as const) {
    await dialog.getByRole("combobox", { name: `第 ${i} 筆的類別` }).click();
    await page.getByRole("option", { name: category, exact: true }).click();
  }
  await dialog.getByLabel("第 1 筆的備註（可留空）").fill(`${E2E} 乾電池`);
  await expect(dialog).toContainText("合計 $340 / 發票 $340");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/scan-confirm.png`, fullPage: true });
  await dialog.getByRole("button", { name: "確認入帳 3 筆" }).click();
  await expect(toasts.getByText("已入帳 3 筆")).toBeVisible();
  await expect(dialog).toBeHidden();

  // 交易清單：三筆
  await page.goto("/transactions");
  await expect(page.getByText(`${E2E} 乾電池`)).toBeVisible();
  await expect(page.getByRole("button", { name: /醫療 −\$210/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /飲食 −\$25/ })).toBeVisible();

  // 重新進掃描頁再傳同一張：擋下
  await page.goto("/scan");
  await page.getByLabel("上傳發票照片").setInputFiles({ name: "invoice.png", mimeType: "image/png", buffer: photo });
  await expect(toasts.getByText(`發票 ${qr.invoiceNo} 已經記過了（或已在待確認匣）`)).toBeVisible({ timeout: 30_000 });
});

test("連續模式：掃到的發票放進待確認匣，店家記憶帶出上次的類別", async ({ page, browser }) => {
  const qr = invoiceQrTexts("22555003");
  const photo = await invoicePhoto(browser, qr.left, qr.right);
  const toasts = page.getByRole("region", { name: /Notifications/ });

  await page.goto("/scan");
  await page.getByRole("radio", { name: /連續/ }).click();
  await page.getByLabel("上傳發票照片").setInputFiles({ name: "invoice.png", mimeType: "image/png", buffer: photo });
  await expect(toasts.getByText("已放進待確認匣：統一超商股份有限公司・$340")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: "這次掃到的發票" })).toContainText(qr.invoiceNo);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/scan-batch.png`, fullPage: true });

  // 上一個測試確認過同一家店（第一筆類別：購物、付款：現金），所以可以直接確認
  await page.goto("/inbox");
  const item = page.getByRole("listitem").filter({ hasText: qr.invoiceNo });
  await expect(item).toContainText("現金 → 購物");
  await item.getByRole("button", { name: "確認「統一超商股份有限公司」" }).click();
  await expect(toasts.getByText("已入帳「統一超商股份有限公司」")).toBeVisible();
});
