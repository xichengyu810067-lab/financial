import { cacheLife } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * 用統一編號查店名（經濟部商工行政資料開放平臺，公開資料、不需金鑰）。
 * 先查公司登記，查不到再查商業登記（行號）。瀏覽器直接呼叫會被跨網域擋，所以由這裡代查；
 * 只給登入者用，避免變成公開代理。只送出店家統編，不含使用者資料。
 *
 * 防濫用：同一個統編的結果快取（公開資料，不分使用者）；每位使用者每分鐘最多查 30 次，
 * 避免有人拿這裡大量打經濟部 API，害整個網站被對方封鎖。
 */

const GCIS = "https://data.gcis.nat.gov.tw/od/data/api";
const COMPANY = "F05D1060-7D57-4763-BDCE-0DAF5975AFE0"; // 公司登記基本資料-應用二
const BUSINESS = "426D5542-5F05-43EB-83F9-F1300F14E1F1"; // 商業登記基本資料-應用三

const limiter = createRateLimiter(30, 60_000);

/** 查不到回 null；網路錯誤或對方出錯就丟例外（不要把暫時失敗快取起來） */
async function query(dataset: string, field: string, ban: string, nameField: string): Promise<string | null> {
  const url = new URL(`${GCIS}/${dataset}`);
  url.searchParams.set("$format", "json");
  url.searchParams.set("$filter", `${field} eq ${ban}`);
  url.searchParams.set("$skip", "0");
  url.searchParams.set("$top", "1");
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!res.ok) throw new Error(`GCIS ${res.status}`);
  const text = await res.text();
  if (!text.trim()) return null;
  const rows = JSON.parse(text) as Record<string, unknown>[];
  const name = Array.isArray(rows) ? rows[0]?.[nameField] : undefined;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : null;
}

async function lookupMerchant(ban: string): Promise<string | null> {
  "use cache";
  cacheLife("weeks");
  return (await query(COMPANY, "Business_Accounting_NO", ban, "Company_Name")) ?? (await query(BUSINESS, "President_No", ban, "Business_Name"));
}

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const ban = request.nextUrl.searchParams.get("ban") ?? "";
  if (!/^\d{8}$/.test(ban)) {
    return NextResponse.json({ error: "統一編號格式不正確" }, { status: 400, headers: PRIVATE });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "需要登入" }, { status: 401, headers: PRIVATE });
  }

  const limit = limiter(userId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "查詢太頻繁，請稍後再試" },
      { status: 429, headers: { ...PRIVATE, "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    const name = await lookupMerchant(ban);
    return NextResponse.json({ ban, name }, { headers: PRIVATE });
  } catch {
    // 查不到或逾時就讓使用者自己認；不擋記帳
    return NextResponse.json({ ban, name: null }, { headers: PRIVATE });
  }
}
