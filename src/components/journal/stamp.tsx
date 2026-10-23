import type { ReactNode } from "react";
import { cn } from "cn";

interface StampProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}

/** 圓形印章：主題色外框、手寫字、微微傾斜 */
export function Stamp({ children, className, size = "md" }: StampProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none inline-flex shrink-0 -rotate-12 items-center justify-center rounded-full border-2 border-primary text-center font-hand leading-tight text-primary opacity-85",
        size === "md" ? "size-[58px] text-[13px]" : "size-11 text-[11px]",
        className,
      )}
    >
      {children}
    </span>
  );
}
