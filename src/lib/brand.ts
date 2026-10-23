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

/** 筆記本封面材質（存在 ledgers.cover_material） */
export const COVER_MATERIALS = [
  { id: "linen", label: "布面", description: "織紋，最像手帳本" },
  { id: "leather", label: "皮面", description: "皮革顆粒，沉穩" },
  { id: "kraft", label: "牛皮紙", description: "橫紋紙面，輕鬆" },
] as const;

export type CoverMaterialId = (typeof COVER_MATERIALS)[number]["id"];

export const DEFAULT_COVER_MATERIAL: CoverMaterialId = "linen";

/** 筆記本封面顏色（存在 ledgers.cover_color）；label 用來說明，ink 是封面上文字的顏色 */
export const COVER_COLORS = [
  { id: "navy", label: "深藍", hex: "#2F4A63", spine: "#243B50", ink: "#F7F1E6" },
  { id: "forest", label: "墨綠", hex: "#2F5D4A", spine: "#24493A", ink: "#F3F7EC" },
  { id: "plum", label: "深紫", hex: "#5B3A5E", spine: "#472C49", ink: "#F7EEF6" },
  { id: "brown", label: "咖啡", hex: "#6B3E2E", spine: "#563225", ink: "#F3E6C9" },
  { id: "kraft", label: "牛皮色", hex: "#C9A277", spine: "#B08A5E", ink: "#2B2420" },
  { id: "charcoal", label: "炭黑", hex: "#3A3438", spine: "#2B262A", ink: "#F4EAE2" },
] as const;

export type CoverColorId = (typeof COVER_COLORS)[number]["id"];

export const DEFAULT_COVER_COLOR: CoverColorId = "navy";

export function coverMaterialOf(value: string | null | undefined): CoverMaterialId {
  return COVER_MATERIALS.some((m) => m.id === value) ? (value as CoverMaterialId) : DEFAULT_COVER_MATERIAL;
}

export function coverColorOf(value: string | null | undefined) {
  return COVER_COLORS.find((c) => c.id === value) ?? COVER_COLORS[0];
}
