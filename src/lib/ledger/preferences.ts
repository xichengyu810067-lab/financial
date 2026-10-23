/**
 * 記帳習慣（存在瀏覽器 localStorage，以帳本為鍵）：
 * 下次開啟記帳面板時預設帶入上次使用的帳戶。讀寫都包 try/catch，
 * 無痕模式或被封鎖時靜默失敗。
 */

export interface LastAccounts {
  expenseFrom?: string;
  incomeTo?: string;
  transferFrom?: string;
  transferTo?: string;
}

const KEY_PREFIX = "financial:last-accounts:";

export function readLastAccounts(ledgerId: string): LastAccounts {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + ledgerId);
    return raw ? (JSON.parse(raw) as LastAccounts) : {};
  } catch {
    return {};
  }
}

export function writeLastAccounts(ledgerId: string, patch: LastAccounts): void {
  try {
    const next = { ...readLastAccounts(ledgerId), ...patch };
    window.localStorage.setItem(KEY_PREFIX + ledgerId, JSON.stringify(next));
  } catch {
    // ignore
  }
}
