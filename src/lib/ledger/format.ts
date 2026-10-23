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

/** 今天的 YYYY-MM-DD（本地時區） */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
