import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 用統一編號查店名（經濟部商工行政資料開放平臺，公開資料、不需金鑰）。
 * 先查公司登記，查不到再查商業登記（行號）。瀏覽器直接呼叫會被跨網域擋，所以由這裡代查；
 * 只給登入者用，避免變成公開代理。只送出店家統編，不含使用者資料。
 */

const GCIS = "https://data.gcis.nat.gov.tw/od/data/api";
const COMPANY = "F05D1060-7D57-4763-BDCE-0DAF5975AFE0"; // 公司登記基本資料-應用二
const BUSINESS = "426D5542-5F05-43EB-83F9-F1300F14E1F1"; // 商業登記基本資料-應用三

async function query(dataset: string, field: string, ban: string, nameField: string): Promise<string | null> {
  const url = new URL(`${GCIS}/${dataset}`);
  url.searchParams.set("$format", "json");
  url.searchParams.set("$filter", `${field} eq ${ban}`);
  url.searchParams.set("$skip", "0");
  url.searchParams.set("$top", "1");
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  const rows = JSON.parse(text) as Record<string, unknown>[];
  const name = rows[0]?.[nameField];
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

export async function GET(request: NextRequest) {
  const ban = request.nextUrl.searchParams.get("ban") ?? "";
  if (!/^\d{8}$/.test(ban)) {
    return NextResponse.json({ error: "統一編號格式不正確" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return NextResponse.json({ error: "需要登入" }, { status: 401 });
  }

  try {
    const name =
      (await query(COMPANY, "Business_Accounting_NO", ban, "Company_Name")) ?? (await query(BUSINESS, "President_No", ban, "Business_Name"));
    return NextResponse.json({ ban, name });
  } catch {
    // 查不到或逾時就讓使用者自己認；不擋記帳
    return NextResponse.json({ ban, name: null });
  }
}
