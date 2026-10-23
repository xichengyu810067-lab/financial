/**
 * 複式簿記分錄規則
 *
 * 使用者只填「簡易交易」（收入 / 支出 / 轉帳 / 期初餘額），
 * 這裡負責把它轉成借貸平衡的分錄行（entry_lines）。
 *
 * 正常餘額方向：
 *   資產、費用      = 借方 − 貸方
 *   負債、權益、收入 = 貸方 − 借方
 * 因此同一套規則自然涵蓋信用卡（負債）消費與還款，不需特例。
 */

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type EntryKind = "income" | "expense" | "transfer" | "opening" | "adjustment";

export interface AccountRef {
  id: string;
  type: AccountType;
  name?: string;
}

export interface Line {
  accountId: string;
  debit: number;
  credit: number;
}

export type SimpleEntryInput =
  | { kind: "expense"; amount: number; fromAccount: AccountRef; category: AccountRef }
  | { kind: "income"; amount: number; toAccount: AccountRef; category: AccountRef }
  | { kind: "transfer"; amount: number; fromAccount: AccountRef; toAccount: AccountRef }
  | { kind: "opening"; amount: number; toAccount: AccountRef; openingEquity: AccountRef };

export class PostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostingError";
  }
}

/** 轉成「分」再比較，避免浮點誤差 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function assertValidAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PostingError("金額必須是大於 0 的數字");
  }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    throw new PostingError("金額最多兩位小數");
  }
}

/** 依科目類型回傳正常餘額（正數代表該科目「有餘額」） */
export function normalBalance(type: AccountType, debit: number, credit: number): number {
  const cents = toCents(debit) - toCents(credit);
  const signed = type === "asset" || type === "expense" ? cents : -cents;
  return signed / 100;
}

export function isBalanced(lines: Line[]): boolean {
  if (lines.length < 2) return false;
  const debit = lines.reduce((sum, l) => sum + toCents(l.debit), 0);
  const credit = lines.reduce((sum, l) => sum + toCents(l.credit), 0);
  return debit === credit;
}

function debitLine(account: AccountRef, amount: number): Line {
  return { accountId: account.id, debit: amount, credit: 0 };
}

function creditLine(account: AccountRef, amount: number): Line {
  return { accountId: account.id, debit: 0, credit: amount };
}

function assertBalanceAccount(account: AccountRef, label: string): void {
  if (account.type !== "asset" && account.type !== "liability") {
    throw new PostingError(`${label}必須是資產或負債帳戶`);
  }
}

/**
 * 把簡易交易轉成分錄行。
 *
 * | 交易   | 借方         | 貸方         |
 * |--------|--------------|--------------|
 * | 支出   | 費用類別     | 來源帳戶     |
 * | 收入   | 去向帳戶     | 收入類別     |
 * | 轉帳   | 去向帳戶     | 來源帳戶     |
 * | 期初   | 資產帳戶 ↔ 期初餘額（權益）；負債帳戶方向相反 |
 */
export function buildLines(input: SimpleEntryInput): Line[] {
  assertValidAmount(input.amount);
  const amount = toCents(input.amount) / 100;

  switch (input.kind) {
    case "expense": {
      assertBalanceAccount(input.fromAccount, "來源帳戶");
      if (input.category.type !== "expense") {
        throw new PostingError("支出的類別必須是費用科目");
      }
      return [debitLine(input.category, amount), creditLine(input.fromAccount, amount)];
    }
    case "income": {
      assertBalanceAccount(input.toAccount, "去向帳戶");
      if (input.category.type !== "revenue") {
        throw new PostingError("收入的類別必須是收入科目");
      }
      return [debitLine(input.toAccount, amount), creditLine(input.category, amount)];
    }
    case "transfer": {
      assertBalanceAccount(input.fromAccount, "來源帳戶");
      assertBalanceAccount(input.toAccount, "去向帳戶");
      if (input.fromAccount.id === input.toAccount.id) {
        throw new PostingError("轉帳的來源與去向帳戶不能相同");
      }
      return [debitLine(input.toAccount, amount), creditLine(input.fromAccount, amount)];
    }
    case "opening": {
      assertBalanceAccount(input.toAccount, "期初帳戶");
      if (input.openingEquity.type !== "equity") {
        throw new PostingError("期初餘額的對方科目必須是權益科目");
      }
      // 資產期初：借 資產 / 貸 期初餘額；負債期初（例如卡債）：借 期初餘額 / 貸 負債
      return input.toAccount.type === "asset"
        ? [debitLine(input.toAccount, amount), creditLine(input.openingEquity, amount)]
        : [debitLine(input.openingEquity, amount), creditLine(input.toAccount, amount)];
    }
  }
}

/** 給表單預覽用：「借 飲食 150 / 貸 現金 150」 */
export function describeLines(lines: Line[], nameOf: (accountId: string) => string): string {
  const debits = lines.filter((l) => l.debit > 0).map((l) => `借 ${nameOf(l.accountId)} ${l.debit}`);
  const credits = lines.filter((l) => l.credit > 0).map((l) => `貸 ${nameOf(l.accountId)} ${l.credit}`);
  return [...debits, ...credits].join(" / ");
}
