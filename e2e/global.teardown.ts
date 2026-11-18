import { existsSync, readFileSync } from "node:fs";
import { expect, test as teardown } from "@playwright/test";
import { E2E, RUN_FILE, cleanupE2EData, testClient, type RunState } from "./support";

teardown("清掉 [E2E] 資料並還原設定", async () => {
  const state: RunState | undefined = existsSync(RUN_FILE) ? JSON.parse(readFileSync(RUN_FILE, "utf8")) : undefined;
  const counts = await cleanupE2EData(state);
  console.log("E2E 清理：", counts);

  // 確認帳本裡沒有任何 [E2E] 資料
  const { supabase, ledgerId } = await testClient();
  const like = `${E2E}%`;
  const [entries, goals] = await Promise.all([
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("ledger_id", ledgerId).like("memo", like),
    supabase.from("goals").select("id", { count: "exact", head: true }).eq("ledger_id", ledgerId).like("name", like),
  ]);
  await supabase.auth.signOut();
  expect(entries.count, "還有 [E2E] 交易沒清掉").toBe(0);
  expect(goals.count, "還有 [E2E] 目標沒清掉").toBe(0);
});
