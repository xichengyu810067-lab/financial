import { describe, expect, it } from "vitest";
import {
  confirmPayload,
  inboxTitle,
  initialDraft,
  invoiceLines,
  isReady,
  payloadAsIs,
  splitsFromInvoice,
  splitsTotal,
  validateDraft,
  type InboxItem,
} from "./inbox-model";

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "i1",
    ledger_id: "L",
    source: "recurring",
    status: "pending",
    kind: "expense",
    entry_date: "2026-11-05",
    amount: 12000,
    from_account_id: "bank",
    to_account_id: null,
    category_id: "rent",
    memo: "房租",
    merchant_name: null,
    seller_ban: null,
    invoice_no: null,
    items: [],
    recurring_rule_id: "r1",
    due_date: "2026-11-05",
    entry_ids: [],
    created_at: "",
    resolved_at: null,
    ...overrides,
  };
}

const invoice = (overrides: Partial<InboxItem> = {}) =>
  item({
    source: "invoice_qr",
    amount: 300,
    from_account_id: "cash",
    category_id: "food",
    memo: null,
    merchant_name: "全家便利商店",
    invoice_no: "AB12345678",
    recurring_rule_id: null,
    due_date: null,
    items: [
      { name: "便當", qty: 1, price: 100 },
      { name: "牙膏", qty: 2, price: 100 },
    ],
    ...overrides,
  });

describe("isReady", () => {
  it("帳戶與類別都有才算好", () => {
    expect(isReady(item())).toBe(true);
    expect(isReady(item({ category_id: null }))).toBe(false);
    expect(isReady(item({ kind: "income", to_account_id: "bank", from_account_id: null }))).toBe(true);
    expect(isReady(item({ kind: "income", to_account_id: null }))).toBe(false);
    expect(isReady(item({ kind: "transfer", to_account_id: "cash", category_id: null }))).toBe(true);
  });
});

describe("invoiceLines／splitsFromInvoice", () => {
  it("讀出品項並各拆一筆", () => {
    expect(invoiceLines(invoice())).toHaveLength(2);
    expect(splitsFromInvoice(invoice())).toEqual([
      { categoryId: "food", amount: "100", memo: "便當" },
      { categoryId: "food", amount: "200", memo: "牙膏 ×2" },
    ]);
  });
  it("格式不對的品項略過；只有一個品項就不拆", () => {
    expect(invoiceLines(item({ items: [{ name: "x" }, "y", null] }))).toEqual([]);
    expect(splitsFromInvoice(invoice({ items: [{ name: "便當", qty: 1, price: 300 }] }))).toEqual([{ categoryId: "food", amount: "300", memo: "" }]);
  });
});

describe("validateDraft", () => {
  it("預設內容可以直接送出", () => {
    expect(validateDraft(item(), initialDraft(item()))).toBeNull();
    expect(validateDraft(invoice(), initialDraft(invoice()))).toBeNull();
    expect(validateDraft(invoice(), { ...initialDraft(invoice()), splits: splitsFromInvoice(invoice()) })).toBeNull();
  });

  it("缺帳戶或類別", () => {
    expect(validateDraft(item(), { ...initialDraft(item()), fromAccountId: "" })).toBe("請選擇付款帳戶");
    expect(validateDraft(item({ category_id: null }), initialDraft(item({ category_id: null })))).toBe("請選擇類別");
    const income = item({ kind: "income", from_account_id: null, to_account_id: null });
    expect(validateDraft(income, initialDraft(income))).toBe("請選擇存入帳戶");
  });

  it("轉帳兩邊不能相同、不能拆", () => {
    const transfer = item({ kind: "transfer", to_account_id: "bank", category_id: null });
    expect(validateDraft(transfer, initialDraft(transfer))).toBe("轉出與轉入帳戶不能相同");
    const ok = item({ kind: "transfer", to_account_id: "cash", category_id: null });
    expect(validateDraft(ok, initialDraft(ok))).toBeNull();
    expect(validateDraft(ok, { ...initialDraft(ok), splits: [...initialDraft(ok).splits, ...initialDraft(ok).splits] })).toBe("轉帳不能拆成多筆");
  });

  it("金額格式", () => {
    const draft = initialDraft(item());
    expect(validateDraft(item(), { ...draft, splits: [{ ...draft.splits[0], amount: "0" }] })).toBe("每一筆的金額都要大於 0");
    expect(validateDraft(item(), { ...draft, splits: [{ ...draft.splits[0], amount: "1.234" }] })).toBe("金額最多兩位小數");
  });

  it("固定支出可以改金額；發票拆分合計要等於發票金額", () => {
    const draft = initialDraft(item());
    expect(validateDraft(item(), { ...draft, splits: [{ ...draft.splits[0], amount: "12500" }] })).toBeNull();
    const splits = splitsFromInvoice(invoice());
    splits[1] = { ...splits[1], amount: "150" };
    expect(validateDraft(invoice(), { ...initialDraft(invoice()), splits })).toBe("拆開的金額合計要等於發票金額（還差 50）");
  });

  it("多筆時缺類別的訊息", () => {
    const splits = splitsFromInvoice(invoice());
    splits[0] = { ...splits[0], categoryId: "" };
    expect(validateDraft(invoice(), { ...initialDraft(invoice()), splits })).toBe("每一筆都要選類別");
  });
});

describe("splitsTotal", () => {
  it("用分加總避免浮點誤差", () => {
    expect(splitsTotal([{ categoryId: "", amount: "0.1", memo: "" }, { categoryId: "", amount: "0.2", memo: "" }])).toBe(0.3);
  });
});

describe("confirmPayload／payloadAsIs", () => {
  it("支出：只送付款帳戶與類別", () => {
    expect(payloadAsIs(item())).toEqual({
      entry_date: "2026-11-05",
      from_account_id: "bank",
      to_account_id: null,
      splits: [{ category_id: "rent", amount: 12000, memo: null }],
    });
  });
  it("收入只送存入帳戶；轉帳不送類別；備註去空白", () => {
    const income = item({ kind: "income", from_account_id: "x", to_account_id: "bank", category_id: "salary" });
    expect(confirmPayload(income, initialDraft(income))).toMatchObject({ from_account_id: null, to_account_id: "bank" });
    const transfer = item({ kind: "transfer", to_account_id: "cash", category_id: "rent" });
    const draft = initialDraft(transfer);
    draft.splits[0].memo = "  提款  ";
    expect(confirmPayload(transfer, draft).splits).toEqual([{ category_id: null, amount: 12000, memo: "提款" }]);
  });
});

describe("inboxTitle", () => {
  it("店名優先，其次備註，再其次來源", () => {
    expect(inboxTitle(invoice())).toBe("全家便利商店");
    expect(inboxTitle(item())).toBe("房租");
    expect(inboxTitle(item({ memo: null }))).toBe("固定支出");
  });
});
