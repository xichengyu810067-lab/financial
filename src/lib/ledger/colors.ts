/**
 * 科目顏色。資料庫只存 token 名稱（例如 "rose"），
 * 這裡對應成 Tailwind class（必須是完整字串，Tailwind 才掃得到）與圖表用的 hex。
 */
export const COLORS = {
  slate: { label: "灰", badge: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300", dot: "bg-slate-500", hex: "#64748b" },
  rose: { label: "玫瑰", badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300", dot: "bg-rose-500", hex: "#f43f5e" },
  orange: { label: "橘", badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300", dot: "bg-orange-500", hex: "#f97316" },
  amber: { label: "琥珀", badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", dot: "bg-amber-500", hex: "#f59e0b" },
  yellow: { label: "黃", badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300", dot: "bg-yellow-500", hex: "#eab308" },
  emerald: { label: "綠", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", dot: "bg-emerald-500", hex: "#10b981" },
  teal: { label: "藍綠", badge: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300", dot: "bg-teal-500", hex: "#14b8a6" },
  sky: { label: "天藍", badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300", dot: "bg-sky-500", hex: "#0ea5e9" },
  indigo: { label: "靛", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300", dot: "bg-indigo-500", hex: "#6366f1" },
  violet: { label: "紫", badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300", dot: "bg-violet-500", hex: "#8b5cf6" },
  pink: { label: "粉", badge: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300", dot: "bg-pink-500", hex: "#ec4899" },
} as const;

export type ColorName = keyof typeof COLORS;

export const COLOR_NAMES = Object.keys(COLORS) as ColorName[];

export function getColor(name: string | null | undefined) {
  return (name && name in COLORS ? COLORS[name as ColorName] : COLORS.slate);
}
