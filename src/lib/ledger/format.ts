const twd = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 新台幣格式：$12,345 或 $12,345.5 */
export function formatTWD(amount: number | null | undefined): string {
  return twd.format(amount ?? 0);
}

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 今天的 YYYY-MM-DD（本地時區） */
export function todayISO(): string {
  return toISODate(new Date());
}

/** 昨天的 YYYY-MM-DD（本地時區） */
export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

/** 帶正負號的金額：+$1,200、−$300；0 不加符號 */
export function formatSignedTWD(amount: number): string {
  if (Math.abs(amount) < 0.005) return formatTWD(0);
  return (amount > 0 ? "+" : "−") + formatTWD(Math.abs(amount));
}

/** 百分比取到小數一位；null（分母為 0）顯示「—」。signed 時加正負號。 */
export function formatPercent(value: number | null, signed = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const text = `${Math.abs(value).toFixed(1)}%`;
  if (!signed) return `${value < 0 ? "−" : ""}${text}`;
  return value > 0.05 ? `+${text}` : value < -0.05 ? `−${text}` : text;
}
