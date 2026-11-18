// 把 zxing-wasm 的 QR 解碼 WASM 複製到 public/，由自己的網站提供（不從外部 CDN 下載）。
// predev／prebuild 自動執行；public/zxing/ 不進版控。
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
// 套件有 exports，直接解析公開的 wasm 路徑
const source = require.resolve("zxing-wasm/reader/zxing_reader.wasm");
const target = join(process.cwd(), "public", "zxing");
mkdirSync(target, { recursive: true });
copyFileSync(source, join(target, "zxing_reader.wasm"));
