import { expect, test } from "@playwright/test";
import { E2E_INVOICE_PREFIX } from "./support";

const SHOTS = process.env.E2E_SCREENSHOTS;

const no = () => `${E2E_INVOICE_PREFIX}${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

test("匯入載具明細檔 → 摘要 → 放進待確認匣 → 再匯一次全部略過 → 確認一張", async ({ page }) => {
  const toasts = page.getByRole("region", { name: /Notifications/ });
  const [gas, shop, voided] = [no(), no(), no()];
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const csv = [
    "﻿表頭=M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|",
    "明細=D|發票號碼|小計|品項名稱|",
    `M|手機條碼|/ABC+123|${ymd}|73905876|[E2E]加油站|${gas}|161|開立|`,
    `D|${gas}|165|92無鉛汽油|`,
    `D|${gas}|-4|92無鉛汽油折抵額|`,
    `M|手機條碼|/ABC+123|${ymd}|12345678|[E2E]雜貨店|${shop}|300|開立|`,
    `D|${shop}|100|便當|`,
    `D|${shop}|200|牙膏|`,
    `M|手機條碼|/ABC+123|${ymd}|22222222|[E2E]作廢店|${voided}|50|作廢|`,
    `D|${voided}|50|商品|`,
  ].join("\r\n");
  const file = { name: "載具明細.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") };

  await page.goto("/inbox");
  await page.getByRole("button", { name: "匯入載具明細" }).click();
  const dialog = page.getByRole("dialog", { name: "匯入載具明細" });
  await dialog.getByLabel("選擇載具明細檔").setInputFiles(file);
  const summary = dialog.getByRole("region", { name: "明細檔內容" });
  await expect(summary).toContainText("每月寄送格式");
  await expect(summary).toContainText("新發票 2 張，合計 $461");
  await expect(summary).toContainText("作廢的發票：1 張");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/import.png` });
  await dialog.getByRole("button", { name: "放進待確認匣 2 張" }).click();
  await expect(toasts.getByText("已放進待確認匣 2 張發票")).toBeVisible();

  const gasRow = page.getByRole("listitem").filter({ hasText: gas });
  const shopRow = page.getByRole("listitem").filter({ hasText: shop });
  await expect(gasRow).toContainText("[E2E]加油站");
  await expect(gasRow).toContainText("載具匯入");
  await expect(gasRow).toContainText("−$161");
  await expect(shopRow).toContainText("−$300");

  // 同一個檔再匯一次：全部略過
  await page.getByRole("button", { name: "匯入載具明細" }).click();
  await dialog.getByLabel("選擇載具明細檔").setInputFiles(file);
  await expect(summary).toContainText("新發票 0 張");
  await expect(summary).toContainText("已經在帳本或待確認匣：2 張");
  await expect(dialog.getByRole("button", { name: "放進待確認匣 0 張" })).toBeDisabled();
  await dialog.getByRole("button", { name: "取消" }).click();

  // 確認一張（沒有建議類別 → 選類別…）
  await gasRow.getByRole("button", { name: "確認「[E2E]加油站」" }).click();
  const confirm = page.getByRole("dialog", { name: "確認「[E2E]加油站」" });
  await confirm.getByRole("combobox", { name: "付款帳戶" }).click();
  await page.getByRole("option", { name: /^現金/ }).click();
  await confirm.getByRole("combobox", { name: "類別" }).click();
  await page.getByRole("option", { name: "交通", exact: true }).click();
  await confirm.getByRole("button", { name: "確認入帳" }).click();
  await expect(toasts.getByText("已入帳")).toBeVisible();
  await expect(gasRow).toHaveCount(0);
});
