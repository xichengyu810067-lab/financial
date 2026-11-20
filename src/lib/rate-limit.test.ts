import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("視窗內超過上限就擋，過了視窗重新計算", () => {
    const limit = createRateLimiter(3, 60_000);
    expect(limit("u1", 0).ok).toBe(true);
    expect(limit("u1", 1).ok).toBe(true);
    expect(limit("u1", 2).ok).toBe(true);
    const blocked = limit("u1", 30_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(30);
    expect(limit("u1", 60_000).ok).toBe(true);
  });

  it("不同 key 各自計算", () => {
    const limit = createRateLimiter(1, 60_000);
    expect(limit("u1", 0).ok).toBe(true);
    expect(limit("u2", 0).ok).toBe(true);
    expect(limit("u1", 0).ok).toBe(false);
  });

  it("key 數量到上限時清掉舊的，不會無限長大", () => {
    const limit = createRateLimiter(1, 1000, 2);
    limit("a", 0);
    limit("b", 0);
    expect(limit("c", 5000).ok).toBe(true); // a、b 已過期被清掉
    expect(limit("a", 5000).ok).toBe(true);
  });
});
