import { expect, test } from "@playwright/test";

// 只攔截瀏覽器的請求、不寫資料庫：模擬斷線，確認看得到錯誤與重試，恢復後重試就載入

test("頁面主要資料載入失敗：顯示錯誤與重試，恢復連線後重試就載入", async ({ page }) => {
  const balances = /\/rest\/v1\/account_balances/;
  await page.route(balances, (route) => route.abort("internetdisconnected"));
  await page.goto("/accounts");

  const alert = page.getByRole("alert").filter({ hasText: "這一頁載入失敗" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("連線失敗");
  // 只有這一頁換成錯誤，頂部分頁還在
  await expect(page.getByRole("link", { name: "報表" }).first()).toBeVisible();

  await page.unroute(balances);
  await alert.getByRole("button", { name: "重試" }).click();
  await expect(alert).toBeHidden();
  await expect(page.getByRole("heading", { name: "帳戶" })).toBeVisible();
  await expect(page.getByText("資產", { exact: true }).first()).toBeVisible();
});

test("報表載入失敗：就地顯示錯誤，重試只重抓報表", async ({ page }) => {
  const income = /\/rest\/v1\/rpc\/report_income_statement/;
  await page.route(income, (route) => route.abort("internetdisconnected"));
  await page.goto("/reports");
  await page.getByRole("tab", { name: "損益表" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "報表載入失敗" });
  await expect(alert).toBeVisible();
  // 頁面其他部分照常（期間選擇還在）
  await expect(page.getByRole("radiogroup", { name: "期間長度" })).toBeVisible();

  await page.unroute(income);
  await alert.getByRole("button", { name: "重試" }).click();
  await expect(alert).toBeHidden();
  await expect(page.getByRole("tab", { name: "損益表" })).toHaveAttribute("aria-selected", "true");
});

test("報表明細分頁抓取：一次最多 1000 筆，用 offset 接著抓", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (/\/rest\/v1\/entries\?/.test(req.url())) requests.push(req.url());
  });
  await page.goto("/today");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    const params = new URL(url).searchParams;
    expect(params.get("limit")).toBe("1000");
    expect(params.get("offset")).toBe("0");
    // 排序最後加 id，換頁時才不會重複或漏掉
    expect(params.get("order")).toMatch(/id\.asc$/);
  }
});
