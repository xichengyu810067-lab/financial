import type { InvoiceLine } from "./inbox-model";

/**
 * 載具消費明細檔解析（里程碑 7 PR C）。財政部電子發票整合服務平台目前看得到兩種檔案：
 *
 * 1. 每月寄送／舊版下載（`|` 分隔，也有逗號版）
 *      表頭=M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|
 *      明細=D|發票號碼|小計|品項名稱|
 *      M|手機條碼|/ABC+123|20260506|73905876|台灣中油加油站|AQ98143668|161|開立|
 *      D|AQ98143668|165|92無鉛汽油|
 *      D|AQ98143668|-4|92無鉛汽油折抵額|
 *    品項名稱可能含換行（後面幾行接回同一個品項）；小計可以是負的（折抵）。
 *
 * 2. 官網「雲端發票明細」下載（逗號分隔、中文標題列、一列一個品項、同一張發票多列）
 *      載具自訂名稱,發票日期,發票號碼,發票金額,發票狀態,折讓,賣方統一編號,賣方名稱,賣方地址,買方統編,消費明細_數量,消費明細_單價,消費明細_金額,消費明細_品名
 *    品名裡的逗號沒有加引號；檔尾有說明文字；整張金額是各列品項金額加總。
 *
 * 格式依其他開源記帳專案的測試資料整理（非財政部正式文件），拿到使用者實際的檔案後再核對。
 */

export interface CsvInvoice {
  invoiceNo: string;
  /** YYYY-MM-DD */
  date: string;
  sellerBan: string | null;
  merchantName: string | null;
  /** 含稅總計（折抵後） */
  total: number;
  status: string;
  /** 官網下載檔的「折讓」欄為「是」 */
  allowance: boolean;
  items: InvoiceLine[];
}

export interface CsvParseResult {
  format: "monthly" | "download" | null;
  invoices: CsvInvoice[];
  /** 作廢而略過的張數 */
  voided: number;
  /** 讀不懂的列（第幾行：原因） */
  errors: string[];
}

/** 檔案位元組 → 文字：去掉 BOM，先試 UTF-8，不合法再用 Big5 */
export function decodeInvoiceFile(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("big5").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

const INVOICE_NO = /^[A-Z]{2}\d{8}$/;
const cents = (n: number) => Math.round(n * 100);
const round2 = (n: number) => Math.round(n * 100) / 100;

function isoDate(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const ban = (value: string | undefined) => (value && /^\d{8}$/.test(value.trim()) ? value.trim() : null);
const unquote = (value: string) => {
  const v = value.trim();
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v;
};
const num = (value: string | undefined) => {
  if (value === undefined || value.trim() === "") return NaN;
  return Number(value.trim().replace(/,/g, ""));
};

export function parseInvoiceCsv(raw: string): CsvParseResult {
  const text = raw.replace(/^﻿/, "");
  const lines = text.split(/\r\n|\n|\r/);
  const first = lines.find((l) => l.trim() !== "")?.trim() ?? "";
  if (/^(表頭=)?M[|,]/.test(first)) return parseMonthly(lines);
  if (first.includes("發票號碼") && first.includes("消費明細")) return parseDownload(lines);
  return { format: null, invoices: [], voided: 0, errors: ["看不出是哪一種載具明細檔：第一行應該是「表頭=M|…」或「載具自訂名稱,發票日期,…」"] };
}

// ---------------------------------------------------------------------------
// 1. M／D 格式
// ---------------------------------------------------------------------------

function parseMonthly(lines: string[]): CsvParseResult {
  const sep = /^(?:表頭=)?M,/.test(lines.find((l) => l.trim() !== "")?.trim() ?? "") ? "," : "|";
  // 先把被換行拆開的品項名稱接回去：不是 M／D／表頭／明細開頭的行，接到上一行後面
  const records: { line: number; text: string }[] = [];
  lines.forEach((l, i) => {
    if (l.trim() === "") return;
    if (/^(表頭=M|明細=D|M|D)[|,]/.test(l) || records.length === 0) records.push({ line: i + 1, text: l });
    else records[records.length - 1].text += ` ${l.trim()}`;
  });

  const invoices = new Map<string, CsvInvoice>();
  const voidedNos = new Set<string>();
  const errors: string[] = [];
  const dropTrailing = (cols: string[]) => (cols.length > 0 && cols[cols.length - 1].trim() === "" ? cols.slice(0, -1) : cols);

  for (const { line, text } of records) {
    if (text.startsWith("表頭=") || text.startsWith("明細=")) continue;
    const cols = dropTrailing(text.split(sep)).map(unquote);
    if (cols[0] === "M") {
      const [, , , dateRaw, banRaw, name, no, totalRaw, status = ""] = cols;
      const date = isoDate(dateRaw ?? "");
      const total = num(totalRaw);
      if (status.includes("作廢")) {
        if (no) voidedNos.add(no);
        continue;
      }
      if (!no || !INVOICE_NO.test(no) || !date || !Number.isFinite(total)) {
        errors.push(`第 ${line} 行：發票資料不完整`);
        continue;
      }
      invoices.set(no, { invoiceNo: no, date, sellerBan: ban(banRaw), merchantName: name?.trim() || null, total, status, allowance: false, items: [] });
    } else if (cols[0] === "D") {
      const [, no, amountRaw, ...nameParts] = cols;
      if (voidedNos.has(no)) continue;
      const invoice = invoices.get(no);
      const amount = num(amountRaw);
      if (!invoice || !Number.isFinite(amount)) {
        errors.push(`第 ${line} 行：品項找不到對應的發票`);
        continue;
      }
      invoice.items.push({ name: nameParts.join(sep).trim() || "（未命名品項）", qty: 1, price: amount });
    } else {
      errors.push(`第 ${line} 行：看不懂這一行`);
    }
  }
  return { format: "monthly", invoices: [...invoices.values()].filter((i) => i.total > 0), voided: voidedNos.size, errors };
}

// ---------------------------------------------------------------------------
// 2. 官網下載的雲端發票明細
// ---------------------------------------------------------------------------

function parseDownload(lines: string[]): CsvParseResult {
  const headerIndex = lines.findIndex((l) => l.includes("發票號碼") && l.includes("消費明細"));
  const header = lines[headerIndex].split(",").map((h) => unquote(h).replace(/^﻿/, ""));
  const col = (name: string) => header.indexOf(name);
  const idx = {
    date: col("發票日期"),
    no: col("發票號碼"),
    status: col("發票狀態"),
    allowance: col("折讓"),
    ban: col("賣方統一編號"),
    seller: col("賣方名稱"),
    qty: col("消費明細_數量"),
    price: col("消費明細_單價"),
    amount: col("消費明細_金額"),
    name: col("消費明細_品名"),
    invoiceAmount: col("發票金額"),
  };
  const invoices = new Map<string, CsvInvoice>();
  const voidedNos = new Set<string>();
  const errors: string[] = [];

  lines.slice(headerIndex + 1).forEach((l, offset) => {
    const line = headerIndex + offset + 2;
    if (l.trim() === "") return;
    let cols = l.split(",");
    // 檔尾說明文字之類沒有欄位的行
    if (cols.length < Math.min(header.length, 6)) return;
    // 品名（最後一欄）裡沒加引號的逗號：多出來的欄位併回品名
    if (cols.length > header.length) cols = [...cols.slice(0, header.length - 1), cols.slice(header.length - 1).join(",")];
    cols = cols.map(unquote);

    const no = cols[idx.no] ?? "";
    const status = cols[idx.status] ?? "";
    if (status.includes("作廢")) {
      voidedNos.add(no);
      return;
    }
    const date = isoDate(cols[idx.date] ?? "");
    if (!INVOICE_NO.test(no) || !date) {
      errors.push(`第 ${line} 行：發票資料不完整`);
      return;
    }
    let invoice = invoices.get(no);
    if (!invoice) {
      invoice = {
        invoiceNo: no,
        date,
        sellerBan: ban(cols[idx.ban]),
        merchantName: cols[idx.seller]?.trim() || null,
        total: 0,
        status,
        allowance: (cols[idx.allowance] ?? "").trim() === "是",
        items: [],
      };
      invoices.set(no, invoice);
    }
    const amount = num(cols[idx.amount] ?? cols[idx.invoiceAmount]);
    if (!Number.isFinite(amount)) {
      errors.push(`第 ${line} 行：品項金額不是數字`);
      return;
    }
    const qty = num(cols[idx.qty]);
    const price = num(cols[idx.price]);
    const name = (cols[idx.name] ?? "").trim() || "（未命名品項）";
    invoice.items.push(Number.isFinite(qty) && Number.isFinite(price) && cents(qty * price) === cents(amount) ? { name, qty, price } : { name, qty: 1, price: amount });
    invoice.total = round2(invoice.total + amount);
  });

  return { format: "download", invoices: [...invoices.values()].filter((i) => i.total > 0), voided: voidedNos.size, errors };
}

/** 匯入前摘要 */
export function summarizeInvoices(invoices: CsvInvoice[]) {
  const dates = invoices.map((i) => i.date).sort();
  return {
    count: invoices.length,
    total: round2(invoices.reduce((sum, i) => sum + i.total, 0)),
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    allowance: invoices.filter((i) => i.allowance).length,
  };
}
