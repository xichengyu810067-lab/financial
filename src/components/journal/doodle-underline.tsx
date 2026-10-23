import { cn } from "cn";

/** 手繪波浪底線，顏色跟主題色 */
export function DoodleUnderline({ className, width = 150 }: { className?: string; width?: number }) {
  return (
    <svg
      aria-hidden
      width={width}
      height="10"
      viewBox="0 0 150 10"
      preserveAspectRatio="none"
      fill="none"
      stroke="var(--accent-from)"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={cn("block", className)}
    >
      <path d="M2 6c12-6 24 6 36 0s24-6 36 0 24 6 36 0 24-6 38 0" />
    </svg>
  );
}
