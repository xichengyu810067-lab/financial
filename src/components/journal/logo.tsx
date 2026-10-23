import { cn } from "cn";
import { BRAND_NAME } from "@/lib/brand";

/** 標誌字：手寫體 + 主題漸層 */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "font-hand font-bold leading-tight text-accent-gradient",
        size === "sm" && "text-xl",
        size === "md" && "text-[26px]",
        size === "lg" && "text-5xl",
        className,
      )}
    >
      {BRAND_NAME}
    </span>
  );
}
