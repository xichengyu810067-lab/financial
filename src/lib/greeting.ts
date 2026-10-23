/** 依時段的問候語 */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 11) return "早安";
  if (hour >= 11 && hour < 18) return "午安";
  return "晚安";
}

/** 側欄底部的一句話，依時段變化 */
export function taglineForHour(hour: number): string {
  if (hour >= 5 && hour < 11) return "今天也好好記一筆。";
  if (hour >= 11 && hour < 18) return "吃了什麼，順手記下來。";
  return "今天的帳，今天結。";
}

/** "2026-10-23" → "10月23日 週五" */
const dayFormatter = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" });
export function formatDayLabel(date: Date): string {
  return dayFormatter.format(date);
}
