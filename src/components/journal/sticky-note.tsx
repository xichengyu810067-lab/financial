import type { ReactNode } from "react";
import { cn } from "cn";

/** 黃色便利貼（日期、小提醒） */
export function StickyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block -rotate-2 rounded-[3px] bg-sticky px-3.5 py-2 font-hand text-[15px] text-sticky-ink shadow-[0_2px_0_var(--sticky-shadow)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
