import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const isVercelPreview = process.env.VERCEL_ENV === "preview";

/** Supabase 的網址（REST、Auth 都在這裡）；建置時一定要有，沒有就只允許同網站 */
function supabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * 內容安全政策（CSP）。
 *
 * - script-src 仍要 'unsafe-inline'：本專案開了 cacheComponents／partialPrefetching，
 *   靜態外殼在建置時就產生，沒辦法每次請求換 nonce（Next 文件：PPR 與 nonce CSP 不相容）；
 *   Next 也會插入內容會變的 inline script（RSC 資料），不能用固定 hash。
 *   所以這裡的 CSP 主要是擋：被別的網站嵌入（點擊劫持）、資料被送到陌生網域（connect-src）、
 *   外部 script／plugin、<base> 竄改、表單送到別的網站。
 * - 'wasm-unsafe-eval'：掃發票用的 zxing-wasm 要編譯 WebAssembly。
 * - 'unsafe-eval' 只在開發模式（React 開發版會用 eval 重建錯誤堆疊）。
 * - Vercel 預覽站會注入 vercel.live 的意見回饋工具列，只在預覽站放行。
 */
function contentSecurityPolicy(): string {
  const supabase = supabaseOrigin();
  const supabaseWs = supabase?.replace(/^http/, "ws");
  const vercelLive = isVercelPreview ? "https://vercel.live" : "";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", isDev ? "'unsafe-eval'" : "", vercelLive],
    "style-src": ["'self'", "'unsafe-inline'", vercelLive],
    "img-src": ["'self'", "blob:", "data:", vercelLive],
    "font-src": ["'self'", "data:", vercelLive],
    "media-src": ["'self'", "blob:"],
    "connect-src": ["'self'", supabase ?? "", supabaseWs ?? "", vercelLive],
    "frame-src": [vercelLive || "'none'"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // 沒有 JavaScript 時表單會真的送出：Google 登入會被導到 Supabase → Google
    "form-action": ["'self'", supabase ?? "", "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  // 舊瀏覽器不認得 frame-ancestors 時的備援
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 相機只給自己（掃發票）；其他用不到的感測器全部關掉
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
