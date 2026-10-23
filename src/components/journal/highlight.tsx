import type { ReactNode } from "react";
import { cn } from "cn";

interface HighlightProps {
  children: ReactNode;
  className?: string;
  /** 旋轉角度，預設 -1 */
  tilt?: -2 | -1 | 0 | 1 | 2;
}

const TILT: Record<NonNullable<HighlightProps["tilt"]>, string> = {
  "-2": "-rotate-2",
  "-1": "-rotate-1",
  "0": "",
  "1": "rotate-1",
  "2": "rotate-2",
};

/** 螢光筆畫過的標籤：日期、區段標題用 */
export function Highlight({ children, className, tilt = -1 }: HighlightProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-[4px] bg-highlight px-2.5 py-0.5 font-hand text-[14px] text-accent-foreground",
        TILT[tilt],
        className,
      )}
    >
      {children}
    </span>
  );
}
