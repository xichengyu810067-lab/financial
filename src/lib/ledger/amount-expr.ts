/**
 * 金額算式解析：讓使用者在金額欄直接輸入「120+35」「300*2」「(80+20)/2」。
 * 支援 + - * / × ÷ 與括號、小數；結果四捨五入到兩位小數，且必須大於 0。
 * 純函式，無副作用。
 */

export type AmountResult =
  | { ok: true; value: number; isExpression: boolean }
  | { ok: false; error: string };

const MAX_AMOUNT = 999_999_999_999;

type Token = { type: "num"; value: number } | { type: "op"; value: "+" | "-" | "*" | "/" } | { type: "("; } | { type: ")" };

function normalize(input: string): string {
  return input
    .replace(/[×xX]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[,\s]/g, "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/．/g, ".")
    .replace(/＋/g, "+")
    .replace(/－/g, "-");
}

function tokenize(src: string): Token[] | string {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let dots = 0;
      while (j < src.length && /[0-9.]/.test(src[j])) {
        if (src[j] === ".") dots += 1;
        j += 1;
      }
      const text = src.slice(i, j);
      if (dots > 1 || text === ".") return `「${text}」不是有效的數字`;
      tokens.push({ type: "num", value: Number(text) });
      i = j;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "(" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: ")" });
      i += 1;
      continue;
    }
    return `不支援的字元「${ch}」`;
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.expr();
    if (this.pos < this.tokens.length) throw new Error("算式格式不正確");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expr(): number {
    let value = this.term();
    for (;;) {
      const t = this.peek();
      if (t?.type === "op" && (t.value === "+" || t.value === "-")) {
        this.pos += 1;
        const rhs = this.term();
        value = t.value === "+" ? value + rhs : value - rhs;
      } else {
        return value;
      }
    }
  }

  private term(): number {
    let value = this.factor();
    for (;;) {
      const t = this.peek();
      if (t?.type === "op" && (t.value === "*" || t.value === "/")) {
        this.pos += 1;
        const rhs = this.factor();
        if (t.value === "/") {
          if (rhs === 0) throw new Error("不能除以 0");
          value = value / rhs;
        } else {
          value = value * rhs;
        }
      } else {
        return value;
      }
    }
  }

  private factor(): number {
    const t = this.peek();
    if (!t) throw new Error("算式不完整");
    if (t.type === "num") {
      this.pos += 1;
      return t.value;
    }
    if (t.type === "op" && t.value === "-") {
      this.pos += 1;
      return -this.factor();
    }
    if (t.type === "op" && t.value === "+") {
      this.pos += 1;
      return this.factor();
    }
    if (t.type === "(") {
      this.pos += 1;
      const value = this.expr();
      if (this.peek()?.type !== ")") throw new Error("括號沒有關閉");
      this.pos += 1;
      return value;
    }
    throw new Error("算式格式不正確");
  }
}

/** 解析金額或算式；回傳兩位小數的金額，或可直接顯示的錯誤訊息 */
export function evaluateAmount(input: string): AmountResult {
  const src = normalize(input ?? "");
  if (src === "") return { ok: false, error: "請輸入金額" };

  const tokens = tokenize(src);
  if (typeof tokens === "string") return { ok: false, error: tokens };

  let raw: number;
  try {
    raw = new Parser(tokens).parse();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "算式格式不正確" };
  }

  if (!Number.isFinite(raw)) return { ok: false, error: "算式結果不是有效的數字" };
  const value = Math.round(raw * 100) / 100;
  if (value <= 0) return { ok: false, error: "金額必須大於 0" };
  if (value > MAX_AMOUNT) return { ok: false, error: "金額太大" };

  const isExpression = tokens.some((t) => t.type !== "num");
  return { ok: true, value, isExpression };
}
