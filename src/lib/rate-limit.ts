/**
 * 簡單的固定視窗頻率限制（記憶體內，每個伺服器執行個體各自計算）。
 * Vercel 上多個執行個體不共用計數，所以這只是擋住單一使用者連續狂打的「減速帶」，
 * 不是精確的全站配額；要精確的話需要 Redis 之類的共用儲存。
 */
export type RateLimiter = (key: string, now?: number) => { ok: boolean; retryAfterSec: number };

export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (key, now = Date.now()) => {
    const cur = hits.get(key);
    if (!cur || cur.resetAt <= now) {
      // 太多 key 時先清掉過期的，避免記憶體一直長大
      if (hits.size >= maxKeys) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        if (hits.size >= maxKeys) hits.clear();
      }
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfterSec: 0 };
    }
    if (cur.count >= limit) return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
    cur.count += 1;
    return { ok: true, retryAfterSec: 0 };
  };
}
