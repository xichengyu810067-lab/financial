import {
  ArrowLeftRight,
  CalendarDays,
  ChartColumn,
  NotebookPen,
  Settings,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** 頂部分頁（桌機）；手機底部只放前三個，其餘收進「更多」 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "今天", icon: NotebookPen },
  { href: "/month", label: "本月", icon: CalendarDays },
  { href: "/transactions", label: "交易", icon: ArrowLeftRight },
  { href: "/accounts", label: "帳戶", icon: Wallet },
  { href: "/categories", label: "類別", icon: Tags },
  { href: "/reports", label: "報表", icon: ChartColumn },
  { href: "/settings", label: "設定", icon: Settings },
];

export const MOBILE_PRIMARY_COUNT = 3;

/** 日頁（/days/…）算在「今天」，月章節頁（/months/…）算在「本月」 */
export function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  if (href === "/today") return pathname.startsWith("/days");
  if (href === "/month") return pathname.startsWith("/months");
  return false;
}
