/** 把 Supabase / Postgres 回傳的錯誤轉成使用者看得懂的訊息 */
export function translateDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // 自家 trigger / RPC 以繁中 raise 的訊息直接顯示
  if (/[一-鿿]/.test(message)) return message;
  const lower = message.toLowerCase();
  if (lower.includes("duplicate key")) return "已有同名的帳戶或類別";
  if (lower.includes("violates foreign key") || lower.includes("restrict")) return "此項目仍被其他資料使用，請改用封存";
  if (lower.includes("row-level security") || lower.includes("permission denied")) return "沒有權限執行這個操作";
  if (lower.includes("failed to fetch") || lower.includes("network")) return "連線失敗，請檢查網路後再試";
  return "操作失敗，請稍後再試";
}
