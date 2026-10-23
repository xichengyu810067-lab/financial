import { formatTWD } from "./format";
import { isZero, round2 } from "./report-model";

/**
 * 一天一頁的比較文字（純函式）：跟昨天、跟上週同一天比。
 */

export type CompareTone = "good" | "bad" | "flat";

export interface CompareChip {
  text: string;
  tone: CompareTone;
}

/** 收入：多／少；支出：多花／少花；結餘：多存／少存 */
export function compareChip(kind: "income" | "expense" | "net", current: number, previous: number, against: string): CompareChip {
  const diff = round2(current - previous);
  if (isZero(diff)) return { text: `跟${against}一樣`, tone: "flat" };
  const amount = formatTWD(Math.abs(diff));
  switch (kind) {
    case "income":
      return diff > 0 ? { text: `比${against}多 ${amount}`, tone: "good" } : { text: `比${against}少 ${amount}`, tone: "bad" };
    case "expense":
      return diff > 0 ? { text: `比${against}多花 ${amount}`, tone: "bad" } : { text: `比${against}少花 ${amount}`, tone: "good" };
    case "net":
      return diff > 0 ? { text: `比${against}多存 ${amount}`, tone: "good" } : { text: `比${against}少存 ${amount}`, tone: "bad" };
  }
}

/** 淨值變化：▲／▼ 加金額 */
export function netWorthChange(current: number, previous: number): CompareChip {
  const diff = round2(current - previous);
  if (isZero(diff)) return { text: "持平", tone: "flat" };
  return diff > 0 ? { text: `▲ ${formatTWD(diff)}`, tone: "good" } : { text: `▼ ${formatTWD(Math.abs(diff))}`, tone: "bad" };
}
