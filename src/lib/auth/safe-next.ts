/**
 * 登入後要回去的站內路徑。只接受「同網站的相對路徑」，避免開放式重導向。
 *
 * 只看開頭是不是 `/` 不夠：瀏覽器解析網址時會把 `\` 當成 `/`、會刪掉 tab 與換行，
 * 所以 `/\evil.com`、`/\t/evil.com` 都會被解析成 `https://evil.com/`。
 * 這裡直接拒絕反斜線與控制字元，再用 URL 解析確認結果仍在同一個來源。
 */
const BASE = "http://same-origin.invalid";

export function sanitizeNext(value: unknown, fallback = "/cover"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // 反斜線、控制字元（含 tab、換行）、DEL
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;

  const path = `${url.pathname}${url.search}${url.hash}`;
  // 解析後還是不能變成協定相對網址（例如 /%2F/evil.com 解析後仍是單一路徑，這裡多一層保險）
  if (path.startsWith("//")) return fallback;
  return path;
}
