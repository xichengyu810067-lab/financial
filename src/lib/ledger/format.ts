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
