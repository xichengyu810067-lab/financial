import type { Instrumentation } from "next";

/**
 * 伺服器錯誤（Server Component、Route Handler、Server Action、Proxy）寫成一行 JSON 到 stderr，
 * 在 Vercel 的 Logs 依 level=error 或 digest 搜尋；畫面上的錯誤代碼就是這裡的 digest。
 *
 * 不記錄：query string（登入回呼的 code、next 參數）、標頭（cookie、authorization）、請求內容。
 * 瀏覽器端的查詢錯誤不會經過這裡，只會出現在使用者的主控台與錯誤畫面。
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const err = error instanceof Error ? error : null;
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      source: "onRequestError",
      digest,
      message: (err?.message ?? String(error)).slice(0, 500),
      stack: err?.stack?.split("\n").slice(0, 8).join("\n"),
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    }),
  );
};
