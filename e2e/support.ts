import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

/** 所有 E2E 建立的資料都用這個前綴，teardown 依此清理 */
export const E2E = "[E2E]";

export const AUTH_FILE = "e2e/.auth/user.json";
export const RUN_FILE = "e2e/.auth/run.json";

/** 跑之前記下的原始狀態，teardown 用來還原 */
export interface RunState {
  startedAt: string;
  monthlySpendingLimit: number | null;
}

export function testAccount() {
  const email = process.env.DEV_TEST_EMAIL;
  const password = process.env.DEV_TEST_PASSWORD;
  if (!email || !password) throw new Error("缺少 DEV_TEST_EMAIL／DEV_TEST_PASSWORD，請在 .env.local 設定專用測試帳號");
  // E2E 會在正式資料庫建立與刪除資料，只准用保留網域 .test 的測試帳號，避免誤用平常記帳的帳號
  if (!/@[^@]+\.test$/i.test(email)) {
    throw new Error("DEV_TEST_EMAIL 必須是專用測試帳號（信箱網域以 .test 結尾），拒絕執行 E2E");
  }
  return { email, password };
}

/** 以測試帳號登入的 supabase-js client（走 RLS，只碰得到測試帳號自己的帳本） */
export async function testClient(): Promise<{ supabase: SupabaseClient<Database>; ledgerId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL／NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signInWithPassword(testAccount());
  if (error) throw new Error(`測試帳號登入失敗：${error.message}`);
  const { data: ledger, error: ledgerError } = await supabase.from("ledgers").select("id").single();
  if (ledgerError || !ledger) throw new Error(`找不到測試帳號的帳本：${ledgerError?.message}`);
  return { supabase, ledgerId: ledger.id };
}

/** 刪掉以 [E2E] 開頭的交易、目標（連同存入）、固定支出、分類規則、待確認項目與這次跑之後新增的預算；回傳刪了幾筆 */
export async function cleanupE2EData(state?: RunState) {
  const { supabase, ledgerId } = await testClient();
  const like = `${E2E}%`;
  const counts: Record<string, number> = {};

  const del = async (table: "entries" | "goals" | "goal_deposits" | "recurring_rules" | "category_rules" | "inbox_items", column: string) => {
    const { data, error } = await supabase.from(table).delete().eq("ledger_id", ledgerId).like(column, like).select("id");
    if (error) throw new Error(`清理 ${table} 失敗：${error.message}`);
    counts[table] = (counts[table] ?? 0) + (data?.length ?? 0);
  };
  await del("entries", "memo");
  await del("goal_deposits", "note");
  await del("goals", "name");
  // 里程碑 7：固定支出（待確認項目跟著刪）、分類規則、殘留的待確認項目
  await del("recurring_rules", "name");
  await del("category_rules", "pattern");
  await del("inbox_items", "memo");

  if (state) {
    const { data, error } = await supabase.from("budgets").delete().eq("ledger_id", ledgerId).gte("created_at", state.startedAt).select("id");
    if (error) throw new Error(`清理 budgets 失敗：${error.message}`);
    counts.budgets = data?.length ?? 0;
    const { error: ledgerError } = await supabase
      .from("ledgers")
      .update({ monthly_spending_limit: state.monthlySpendingLimit })
      .eq("id", ledgerId);
    if (ledgerError) throw new Error(`還原每月總支出上限失敗：${ledgerError.message}`);
  }
  await supabase.auth.signOut();
  return counts;
}
