import { describe, expect, it } from "vitest";
import { decodeQrBytes, isLeftQr, isRightQr, itemsComplete, parseInvoiceQr } from "./invoice-qr";

// 財政部規格書 1.8 版第 8 頁的範例（UTF-8 版，中文編碼參數 1）
const LEFT = "AB112233441020523999900000144000001540000000001234567ydXZt4LAN1UHN/j1juVcRA==:**********:3:3:1:乾電池:1:105:";
const RIGHT = "**口罩:1:210:牛奶:1:25";

describe("parseInvoiceQr", () => {
  it("規格書範例：左右合併讀出完整發票", () => {
    const invoice = parseInvoiceQr(LEFT, RIGHT);
    expect(invoice).toEqual({
      invoiceNo: "AB11223344",
      date: "2013-05-23",
      randomCode: "9999",
      salesAmount: 324,
      totalAmount: 340,
      buyerBan: null,
      sellerBan: "01234567",
      items: [
        { name: "乾電池", qty: 1, price: 105 },
        { name: "口罩", qty: 1, price: 210 },
        { name: "牛奶", qty: 1, price: 25 },
      ],
      itemCount: 3,
      totalItemCount: 3,
      encoding: 1,
    });
    expect(itemsComplete(invoice!)).toBe(true);
  });

  it("只有左方：金額與日期照樣讀得到，品項不完整", () => {
    const invoice = parseInvoiceQr(LEFT);
    expect(invoice?.totalAmount).toBe(340);
    expect(invoice?.items).toEqual([{ name: "乾電池", qty: 1, price: 105 }]);
    expect(itemsComplete(invoice!)).toBe(false);
  });

  it("欄位跨在兩個 QR 中間也能接起來", () => {
    const left = LEFT.replace(":乾電池:1:105:", ":乾電池:1:");
    const invoice = parseInvoiceQr(left, "**105:口罩:1:210:牛奶:1:25");
    expect(invoice?.items.map((i) => i.price)).toEqual([105, 210, 25]);
  });

  it("買方有統編時保留；品項數量與單價可以有小數", () => {
    const left = LEFT.replace("0000000001234567", "8765432101234567").replace(":乾電池:1:105:", ":乾電池:1.5:70:");
    const invoice = parseInvoiceQr(left, RIGHT);
    expect(invoice?.buyerBan).toBe("87654321");
    expect(invoice?.items[0]).toEqual({ name: "乾電池", qty: 1.5, price: 70 });
  });

  it("中文編碼參數 2：品名是 Base64", () => {
    const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
    const left = LEFT.replace(":3:3:1:乾電池:", `:3:3:2:${b64("乾電池")}:`);
    const invoice = parseInvoiceQr(left, `**${b64("口罩")}:1:210:${b64("牛奶")}:1:25`);
    expect(invoice?.items.map((i) => i.name)).toEqual(["乾電池", "口罩", "牛奶"]);
  });

  it("境外電商（參數 3）：金額改看後面兩個 10 碼欄位", () => {
    const header = ["AB11223344", "1020523", "9999", "00000000", "00000000", "00000000", "01234567", "ydXZt4LAN1UHN/j1juVcRA=="].join("");
    const left = `${header}:**********:1:1:3:0000000000:0000016B63:Netflix:1:363.99:`;
    const invoice = parseInvoiceQr(left);
    expect(invoice?.totalAmount).toBe(363.99);
    expect(invoice?.items).toEqual([{ name: "Netflix", qty: 1, price: 363.99 }]);
  });

  it("補充說明不會被當成品項", () => {
    const invoice = parseInvoiceQr(LEFT, `${RIGHT}:補充說明文字`);
    expect(invoice?.items).toHaveLength(3);
  });

  it.each([
    ["不是發票", "https://example.com"],
    ["字軌格式錯", LEFT.replace("AB", "a1")],
    ["日期不存在（2/30）", LEFT.replace("1020523", "1020230")],
    ["總計為 0", LEFT.replace("00000154", "00000000")],
  ])("%s → null", (_label, text) => {
    expect(parseInvoiceQr(text)).toBeNull();
  });
});

describe("isLeftQr／isRightQr", () => {
  it("分辨左右", () => {
    expect(isLeftQr(LEFT)).toBe(true);
    expect(isLeftQr(RIGHT)).toBe(false);
    expect(isRightQr(RIGHT)).toBe(true);
    expect(isRightQr(LEFT)).toBe(false);
  });
});

describe("decodeQrBytes", () => {
  it("UTF-8 直接解", () => {
    expect(decodeQrBytes(new TextEncoder().encode("**口罩:1:210"))).toBe("**口罩:1:210");
  });
  it("不是合法 UTF-8 就用 Big5（中文編碼參數 0）", () => {
    // 「口罩」的 Big5：A4 66 B8 6E
    const bytes = new Uint8Array([0x2a, 0x2a, 0xa4, 0x66, 0xb8, 0x6e, 0x3a, 0x31]);
    expect(decodeQrBytes(bytes)).toBe("**口罩:1");
  });
});
