import { createElement } from "react";
import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CirclePlus,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Ellipsis,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  PawPrint,
  Phone,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Shield,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  TrainFront,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * 科目圖示。資料庫只存名稱（lucide 的 kebab-case 名稱），這裡對應成元件與中文說明。
 * 新增圖示時只要加一列。
 */
export const ICONS = {
  banknote: { icon: Banknote, label: "鈔票" },
  landmark: { icon: Landmark, label: "銀行" },
  smartphone: { icon: Smartphone, label: "手機支付" },
  wallet: { icon: Wallet, label: "錢包" },
  "piggy-bank": { icon: PiggyBank, label: "撲滿" },
  coins: { icon: Coins, label: "硬幣" },
  "credit-card": { icon: CreditCard, label: "信用卡" },
  "trending-up": { icon: TrendingUp, label: "投資" },
  "hand-coins": { icon: HandCoins, label: "收款" },
  briefcase: { icon: Briefcase, label: "工作" },
  gift: { icon: Gift, label: "禮物" },
  utensils: { icon: Utensils, label: "餐飲" },
  coffee: { icon: Coffee, label: "咖啡" },
  bus: { icon: Bus, label: "公車" },
  car: { icon: Car, label: "汽車" },
  "train-front": { icon: TrainFront, label: "火車" },
  plane: { icon: Plane, label: "飛機" },
  fuel: { icon: Fuel, label: "加油" },
  house: { icon: House, label: "居住" },
  zap: { icon: Zap, label: "水電" },
  wifi: { icon: Wifi, label: "網路" },
  phone: { icon: Phone, label: "電話" },
  "shopping-bag": { icon: ShoppingBag, label: "購物" },
  shirt: { icon: Shirt, label: "衣物" },
  "gamepad-2": { icon: Gamepad2, label: "遊戲" },
  film: { icon: Film, label: "影視" },
  dumbbell: { icon: Dumbbell, label: "運動" },
  "heart-pulse": { icon: HeartPulse, label: "醫療" },
  pill: { icon: Pill, label: "藥品" },
  "graduation-cap": { icon: GraduationCap, label: "教育" },
  "book-open": { icon: BookOpen, label: "書籍" },
  shield: { icon: Shield, label: "保險" },
  "paw-print": { icon: PawPrint, label: "寵物" },
  baby: { icon: Baby, label: "育兒" },
  wrench: { icon: Wrench, label: "維修" },
  sparkles: { icon: Sparkles, label: "美容" },
  receipt: { icon: Receipt, label: "帳單" },
  "circle-plus": { icon: CirclePlus, label: "其他收入" },
  ellipsis: { icon: Ellipsis, label: "其他" },
  tag: { icon: Tag, label: "標籤" },
} as const satisfies Record<string, { icon: LucideIcon; label: string }>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function getIcon(name: string | null | undefined): LucideIcon {
  return name && name in ICONS ? ICONS[name as IconName].icon : Tag;
}

export function iconLabel(name: string | null | undefined): string | null {
  return name && name in ICONS ? ICONS[name as IconName].label : null;
}

/**
 * 依名稱渲染圖示。用 createElement 而不是把元件存進變數再寫成 JSX，
 * 避免 React Compiler 的 static-components 規則誤判為「在 render 中建立元件」。
 */
export function LedgerIcon({ icon, ...props }: { icon: string | null | undefined } & LucideProps) {
  return createElement(getIcon(icon), props);
}
