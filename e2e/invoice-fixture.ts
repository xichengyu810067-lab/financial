import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "@playwright/test";
import { E2E_INVOICE_PREFIX } from "./support";

/** 照財政部規格組一張發票的左右 QR 文字（UTF-8，中文編碼參數 1）；總計 340 = 105 + 210 + 25 */
export function invoiceQrTexts(sellerBan: string, date = new Date()) {
  const invoiceNo = `${E2E_INVOICE_PREFIX}${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const roc = `${String(date.getFullYear() - 1911).padStart(3, "0")}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(8, "0");
  const header = [invoiceNo, roc, "1234", hex(324), hex(340), "00000000", sellerBan, "ydXZt4LAN1UHN/j1juVcRA=="].join("");
  return {
    invoiceNo,
    left: `${header}:**********:3:3:1:乾電池:1:105:`,
    right: "**口罩:1:210:牛奶:1:25",
  };
}

/** 用 zxing-wasm 產生兩個 QR，在瀏覽器裡並排截圖成一張「發票照片」 */
export async function invoicePhoto(browser: Browser, left: string, right: string): Promise<Buffer> {
  const zx = await import("zxing-wasm/writer");
  zx.prepareZXingModule({ overrides: { wasmBinary: readFileSync(join(process.cwd(), "node_modules/zxing-wasm/dist/writer/zxing_writer.wasm")).buffer as ArrayBuffer } });
  const [l, r] = await Promise.all([left, right].map((text) => zx.writeBarcode(text, { format: "QRCode", scale: 5 })));
  const page = await browser.newPage();
  await page.setContent(
    `<body style="margin:0;background:#fff"><div id="shot" style="display:flex;gap:40px;padding:40px;background:#fff;width:max-content">${l.svg}${r.svg}</div></body>`,
  );
  const png = await page.locator("#shot").screenshot();
  await page.close();
  return png;
}

/** 把截圖裡的一維／二維條碼讀回文字（確認畫出來的條碼掃得到） */
export async function decodeImage(png: Buffer): Promise<string[]> {
  const zx = await import("zxing-wasm/reader");
  zx.prepareZXingModule({ overrides: { wasmBinary: readFileSync(join(process.cwd(), "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm")).buffer as ArrayBuffer } });
  const results = await zx.readBarcodes(new Uint8Array(png), { tryHarder: true });
  return results.filter((r) => r.isValid).map((r) => r.text);
}
