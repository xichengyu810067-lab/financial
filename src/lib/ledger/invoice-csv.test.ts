import { describe, expect, it } from "vitest";
import { decodeInvoiceFile, parseInvoiceCsv, summarizeInvoices } from "./invoice-csv";

const MONTHLY = [
  "﻿表頭=M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|",
  "明細=D|發票號碼|小計|品項名稱|",
  "M|手機條碼|/ABC+123|20261103|73905876|台灣中油加油站|AQ98143668|161|開立|",
  "D|AQ98143668|165|92無鉛汽油|",
  "D|AQ98143668|-4|92無鉛汽油折抵額|",
  "M|手機條碼|/ABC+123|20261105|11111111|某商店|AA11111111|100|作廢|",
  "D|AA11111111|100|商品A|",
  "M|手機條碼|/ABC+123|20261107|60260052|停車場營業所|BR07497744|100|開立|",
  "D|BR07497744|100|進場時間:2026/11/07 17:25",
  "繳費時間:2026/11/07 22:25",
  "停車費|",
  "M|跨境電商電子郵件載具|someone@example.com|20261108|42523557|Google Asia Pacific Pte Ltd|AD23832103|30|開立|",
  "D|AD23832103|30|YouTube|",
].join("\r\n");

const DOWNLOAD = [
  "﻿載具自訂名稱,發票日期,發票號碼,發票金額,發票狀態,折讓,賣方統一編號,賣方名稱,賣方地址,買方統編,消費明細_數量,消費明細_單價,消費明細_金額,消費明細_品名",
  "手機條碼,20261105,CY46407679,45,開立已確認,否,27947182,統一超商股份有限公司某分公司,新北市某路1號,,1,45,45,美式冰咖啡(大)",
  "手機條碼,20261105,CY22484161,70,開立已確認,否,00509071,統一超商股份有限公司某門市,台北市某路2號,,2,35,70,檸檬茶PET600",
  "手機條碼,20261105,CY22484161,-21,開立已確認,否,00509071,統一超商股份有限公司某門市,台北市某路2號,,1,-21,-21,檸檬茶兩件優惠",
  "手機條碼,20261103,DP33705351,60,開立已確認,是,88153830,某茶飲商行,台北市某路3號,,1,60,60,紅茶拿鐵(L)-7分冰,半糖",
  "手機條碼,20261102,ZX12345***,50,作廢,否,22222222,作廢的店,某地址,,1,50,50,商品B",
  "捐贈或作廢之發票，字軌號碼均會隱末3碼",
  "注意：本功能所下載之雲端發票明細檔案可能因賣方營業人後續作廢或折讓等原因而產生誤差。",
].join("\r\n");

describe("parseInvoiceCsv：M／D 格式", () => {
  const result = parseInvoiceCsv(MONTHLY);

  it("認出格式、略過作廢、沒有錯誤", () => {
    expect(result.format).toBe("monthly");
    expect(result.voided).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.invoices.map((i) => i.invoiceNo)).toEqual(["AQ98143668", "BR07497744", "AD23832103"]);
  });

  it("發票欄位與含折抵的品項", () => {
    expect(result.invoices[0]).toEqual({
      invoiceNo: "AQ98143668",
      date: "2026-11-03",
      sellerBan: "73905876",
      merchantName: "台灣中油加油站",
      total: 161,
      status: "開立",
      allowance: false,
      items: [
        { name: "92無鉛汽油", qty: 1, price: 165 },
        { name: "92無鉛汽油折抵額", qty: 1, price: -4 },
      ],
    });
  });

  it("品項名稱跨行接回同一個品項", () => {
    expect(result.invoices[1].items).toEqual([{ name: "進場時間:2026/11/07 17:25 繳費時間:2026/11/07 22:25 停車費", qty: 1, price: 100 }]);
  });

  it("逗號版本也讀得懂", () => {
    const comma = MONTHLY.replaceAll("|", ",");
    const parsed = parseInvoiceCsv(comma);
    expect(parsed.format).toBe("monthly");
    expect(parsed.invoices).toHaveLength(3);
  });

  it("讀不懂的行記進錯誤但不中斷", () => {
    const parsed = parseInvoiceCsv("M|手機條碼|/X|20261101|12345678|店|AB12345678|10|開立|\r\nM|缺欄位|\r\nD|ZZ00000000|5|找不到發票|");
    expect(parsed.invoices).toHaveLength(1);
    expect(parsed.errors).toEqual(["第 2 行：發票資料不完整", "第 3 行：品項找不到對應的發票"]);
  });
});

describe("parseInvoiceCsv：官網下載格式", () => {
  const result = parseInvoiceCsv(DOWNLOAD);

  it("同一張發票的多列歸在一起，總計是品項加總；檔尾說明不算錯誤", () => {
    expect(result.format).toBe("download");
    expect(result.errors).toEqual([]);
    expect(result.voided).toBe(1);
    expect(result.invoices).toHaveLength(3);
    const multi = result.invoices.find((i) => i.invoiceNo === "CY22484161")!;
    expect(multi.total).toBe(49);
    expect(multi.items).toEqual([
      { name: "檸檬茶PET600", qty: 2, price: 35 },
      { name: "檸檬茶兩件優惠", qty: 1, price: -21 },
    ]);
  });

  it("品名裡沒加引號的逗號併回品名；折讓標記", () => {
    const tea = result.invoices.find((i) => i.invoiceNo === "DP33705351")!;
    expect(tea.items).toEqual([{ name: "紅茶拿鐵(L)-7分冰,半糖", qty: 1, price: 60 }]);
    expect(tea.allowance).toBe(true);
    expect(tea.sellerBan).toBe("88153830");
    expect(tea.merchantName).toBe("某茶飲商行");
  });

  it("摘要", () => {
    expect(summarizeInvoices(result.invoices)).toEqual({ count: 3, total: 154, firstDate: "2026-11-03", lastDate: "2026-11-05", allowance: 1 });
  });
});

describe("parseInvoiceCsv：其他", () => {
  it("不認識的檔案", () => {
    const parsed = parseInvoiceCsv("日期,金額\n2026-11-01,100");
    expect(parsed.format).toBeNull();
    expect(parsed.errors[0]).toContain("看不出是哪一種載具明細檔");
  });

  it("decodeInvoiceFile：去 BOM；Big5 檔也讀得出中文", () => {
    expect(decodeInvoiceFile(new TextEncoder().encode("﻿表頭=M|"))).toBe("表頭=M|");
    // 「商店」的 Big5：B0 D3 A9 B1
    expect(decodeInvoiceFile(new Uint8Array([0x4d, 0x7c, 0xb0, 0xd3, 0xa9, 0xb1]))).toBe("M|商店");
  });
});
