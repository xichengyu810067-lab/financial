/**
 * 平台品牌設定。
 * BRAND_NAME 會出現在標誌字、分頁標題與登入頁；想改名只要改這裡。
 */
export const BRAND_NAME = "我的帳本";

/** 未登入首頁的一句話 */
export const BRAND_TAGLINE = "簡單記一筆帳，自動長出完整財報。";

/** 可選的主題色（漸層左下 → 右上） */
export const ACCENTS = [
  { id: "pink", label: "粉紅桃紅", from: "#FF359A", to: "#FF44FF" },
  { id: "sunset", label: "橘黃", from: "#FF6A3D", to: "#FFB347" },
  { id: "mint", label: "青綠", from: "#2F9E8F", to: "#7BE0C8" },
  { id: "violet", label: "靛紫", from: "#4F46E5", to: "#A78BFA" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export const DEFAULT_ACCENT: AccentId = "pink";

export const ACCENT_STORAGE_KEY = "financial:accent";
