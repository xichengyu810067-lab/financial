import type { InvoiceLine } from "./inbox-model";

/**
 * 電子發票證明聯 QR Code 解析（財政部「電子發票證明聯一維及二維條碼規格說明」1.8 版）。
 *
 * 左方 QR：前 77 碼固定
 *   發票字軌號碼(10) 開立日期(7，民國年3+月2+日2) 隨機碼(4) 銷售額(8，16 進位) 總計額(8，16 進位)
 *   買方統編(8，一般消費者 00000000) 賣方統編(8) 加密驗證資訊(24)
 * 接著以「:」分隔：營業人自行使用區(10) : 二維條碼記載完整品目筆數 : 該張發票交易品目總筆數 : 中文編碼參數 : 品名:數量:單價 …
 * 左方放不下的接續記在右方 QR，右方以「**」開頭。
 * 中文編碼參數：0 = Big5、1 = UTF-8、2 = 品名以 Base64 記載、3 = 境外電商（UTF-8，金額改記在後面兩個 10 碼欄位）
 */

export interface ParsedInvoice {
  invoiceNo: string;
  /** YYYY-MM-DD */
  date: string;
  randomCode: string;
  /** 未稅金額；營業人無法分離稅額時為 0 */
  salesAmount: number;
  /** 含稅總計，入帳用這個 */
  totalAmount: number;
  /** 一般消費者為 null */
  buyerBan: string | null;
  sellerBan: string;
  /** QR 裡記載的品項（可能不完整） */
  items: InvoiceLine[];
  /** 左右兩個 QR 記載的完整品目筆數；讀不到為 null */
  itemCount: number | null;
  /** 這張發票的品目總筆數（可能比 QR 裡記載的多） */
  totalItemCount: number | null;
  encoding: number | null;
}

const HEADER = /^([A-Z]{2}\d{8})(\d{3})(\d{2})(\d{2})(\d{4})([0-9A-Fa-f]{8})([0-9A-Fa-f]{8})(\d{8})(\d{8})(.{24})/;

/** 是不是左方 QR（開頭符合固定欄位格式） */
export const isLeftQr = (text: string) => HEADER.test(text);
/** 是不是右方 QR */
export const isRightQr = (text: string) => text.startsWith("**");

/** QR 原始位元組 → 文字：先試 UTF-8，不合法再用 Big5（中文編碼參數 0） */
export function decodeQrBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("big5").decode(bytes);
  }
}

function base64Text(value: string): string {
  try {
    const binary = atob(value);
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return value;
  }
}

function validDate(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const toInt = (value: string | undefined) => {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  return Number(value);
};

/** 境外電商的 10 碼金額：8 碼整數 + 2 碼小數，各自 16 進位 */
const foreignAmount = (value: string | undefined) => {
  if (!value || !/^[0-9A-Fa-f]{10}$/.test(value)) return null;
  return parseInt(value.slice(0, 8), 16) + parseInt(value.slice(8), 16) / 100;
};

/** 解析左方（必要）與右方（選填）QR；格式不對回傳 null */
export function parseInvoiceQr(left: string, right?: string | null): ParsedInvoice | null {
  const m = HEADER.exec(left);
  if (!m) return null;
  const [, invoiceNo, rocYear, month, day, randomCode, salesHex, totalHex, buyer, seller] = m;
  const year = Number(rocYear) + 1911;
  if (!validDate(year, Number(month), Number(day))) return null;

  // 左方 77 碼之後與右方「**」之後是同一串，用字串接起來再切，欄位跨兩個 QR 也不會斷
  const fields = (left.slice(77) + (right && isRightQr(right) ? right.slice(2) : "")).split(":");
  // fields[0] 是 77 碼後面的第一個「:」之前（空字串）
  const itemCount = toInt(fields[2]);
  const totalItemCount = toInt(fields[3]);
  const encoding = toInt(fields[4]);

  let salesAmount = parseInt(salesHex, 16);
  let totalAmount = parseInt(totalHex, 16);
  let itemStart = 5;
  if (encoding === 3) {
    salesAmount = foreignAmount(fields[5]) ?? salesAmount;
    totalAmount = foreignAmount(fields[6]) ?? totalAmount;
    itemStart = 7;
  }
  if (!(totalAmount > 0)) return null;

  const items: InvoiceLine[] = [];
  for (let i = itemStart; i + 2 < fields.length && (itemCount === null || items.length < itemCount); i += 3) {
    const rawName = fields[i];
    const qty = Number(fields[i + 1]);
    const price = Number(fields[i + 2]);
    if (!rawName || !Number.isFinite(qty) || !Number.isFinite(price) || fields[i + 1] === "" || fields[i + 2] === "") break;
    items.push({ name: encoding === 2 ? base64Text(rawName) : rawName, qty, price });
  }

  return {
    invoiceNo,
    date: `${year}-${month}-${day}`,
    randomCode,
    salesAmount,
    totalAmount,
    buyerBan: buyer === "00000000" ? null : buyer,
    sellerBan: seller,
    items,
    itemCount,
    totalItemCount,
    encoding,
  };
}

/** 左方 QR 記載的品目筆數是否都讀到了（沒讀到右方 QR 時用來決定要不要再等一下） */
export function itemsComplete(invoice: ParsedInvoice): boolean {
  return invoice.itemCount === null || invoice.items.length >= invoice.itemCount;
}
