import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE, RUN_FILE, cleanupE2EData, testAccount, testClient, type RunState } from "./support";

setup("檢查測試帳號、清掉上次殘留、記下原始狀態並登入一次", async ({ page }) => {
  const account = testAccount();

  // 上次中斷留下的 [E2E] 資料先清掉
  await cleanupE2EData();

  const { supabase, ledgerId } = await testClient();
  const { data: ledger } = await supabase.from("ledgers").select("monthly_spending_limit").eq("id", ledgerId).single();
  const { data: profile } = await supabase.from("profiles").select("carrier_barcode").single();
  await supabase.auth.signOut();
  const state: RunState = {
    startedAt: new Date().toISOString(),
    monthlySpendingLimit: ledger?.monthly_spending_limit ?? null,
    carrierBarcode: profile?.carrier_barcode ?? null,
  };
  mkdirSync("e2e/.auth", { recursive: true });
  writeFileSync(RUN_FILE, JSON.stringify(state, null, 2));

  // 透過畫面登入一次，存下 cookie 給所有測試共用
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("密碼").fill(account.password);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: AUTH_FILE });
});
