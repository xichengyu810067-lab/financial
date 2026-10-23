import { cn } from "cn";
import { getColor } from "@/lib/ledger/colors";
import { LedgerIcon } from "@/lib/ledger/icons";

interface AccountIconProps {
  icon: string | null | undefined;
  color: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

/** 依科目的 icon／color 渲染一個有底色的圓形圖示 */
export function AccountIcon({ icon, color, size = "md", className }: AccountIconProps) {
  const palette = getColor(color);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "size-9" : "size-7",
        palette.badge,
        className,
      )}
      aria-hidden
    >
      <LedgerIcon icon={icon} className={size === "md" ? "size-4" : "size-3.5"} />
    </span>
  );
}
