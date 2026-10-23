/** 把 Supabase Auth 的英文錯誤轉成使用者看得懂的繁體中文 */
export function translateAuthError(error: { message: string; code?: string }): string {
  const code = error.code ?? "";
  const msg = error.message.toLowerCase();

  // SMTP 設定錯誤時 Supabase 回 unexpected_failure + "Error sending confirmation/recovery email"
  if (msg.includes("error sending") && msg.includes("email")) return "確認信寄送失敗，請稍後再試；若持續發生，請聯絡管理員檢查寄信設定";
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "帳號或密碼錯誤";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return "信箱尚未確認，請先點擊確認信中的連結";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) return "此信箱已註冊，請直接登入";
  if (code === "weak_password") return "密碼強度不足，請至少使用 8 碼";
  if (code === "same_password") return "新密碼不能與舊密碼相同";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || msg.includes("rate limit")) return "操作太頻繁，請稍後再試";
  if (code === "otp_expired" || code === "flow_state_expired" || msg.includes("expired")) return "連結已失效，請重新申請";
  if (code === "session_not_found" || code === "bad_jwt") return "登入狀態已失效，請重新登入";
  if (code === "validation_failed" || code === "bad_json") return "輸入的資料格式不正確";
  if (code === "email_address_invalid") return "Email 格式不正確";
  if (code === "signup_disabled") return "目前暫停開放註冊";

  return "發生錯誤，請稍後再試";
}
