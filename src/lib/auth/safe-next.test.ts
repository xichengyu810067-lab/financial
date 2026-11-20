import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./safe-next";

describe("sanitizeNext", () => {
  it("保留站內路徑、查詢字串與錨點", () => {
    expect(sanitizeNext("/today")).toBe("/today");
    expect(sanitizeNext("/months/2026-11?tab=chart#top")).toBe("/months/2026-11?tab=chart#top");
    expect(sanitizeNext("/days/2026-11-20")).toBe("/days/2026-11-20");
  });

  it("不是字串、空字串或太長時用預設值", () => {
    expect(sanitizeNext(null)).toBe("/cover");
    expect(sanitizeNext(undefined)).toBe("/cover");
    expect(sanitizeNext(123)).toBe("/cover");
    expect(sanitizeNext("")).toBe("/cover");
    expect(sanitizeNext(`/${"a".repeat(3000)}`)).toBe("/cover");
    expect(sanitizeNext("", "/onboarding")).toBe("/onboarding");
  });

  it.each([
    "https://evil.com",
    "http://evil.com/today",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "/\u0000/evil.com",
    "javascript:alert(1)",
    "today",
    " /today",
  ])("擋下外部或可疑網址：%j", (value) => {
    expect(sanitizeNext(value)).toBe("/cover");
  });

  it("百分比編碼的斜線不會變成外部網址", () => {
    const out = sanitizeNext("/%2F/evil.com");
    expect(new URL(out, "https://app.example").origin).toBe("https://app.example");
    const out2 = sanitizeNext("/%5Cevil.com");
    expect(new URL(out2, "https://app.example").origin).toBe("https://app.example");
  });

  it("所有輸出交給瀏覽器解析後都還在同一個網站", () => {
    const samples = ["/a/../../b", "/./x", "/@evil.com", "/..%2F..%2Fevil.com", "/today?next=//evil.com"];
    for (const s of samples) {
      const out = sanitizeNext(s);
      expect(new URL(out, "https://app.example").origin).toBe("https://app.example");
    }
  });
});
