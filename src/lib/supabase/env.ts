/**
 * 讀取 Supabase 連線設定。
 * 兩個變數都是公開值（publishable key 本來就會送到瀏覽器），
 * service role key 絕對不能放進這個專案。
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY，請參考 .env.example 建立 .env.local",
    );
  }
  return { url, key };
}
