import {
  ArrowLeftRight,
  ChartColumn,
  LayoutDashboard,
  Settings,
  Tags,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "儀表板", icon: LayoutDashboard },
  { href: "/transactions", label: "交易", icon: ArrowLeftRight },
  { href: "/accounts", label: "帳戶", icon: Wallet },
  { href: "/categories", label: "類別", icon: Tags },
  { href: "/reports", label: "報表", icon: ChartColumn },
  { href: "/budgets", label: "預算", icon: Target },
  { href: "/settings", label: "設定", icon: Settings },
];
