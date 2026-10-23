import { cn } from "cn";

interface WashiTapeProps {
  tone?: "accent" | "mint" | "sun";
  className?: string;
}

/** 貼在卡片邊緣的紙膠帶（父元素需 relative） */
export function WashiTape({ tone = "accent", className }: WashiTapeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-2 left-5 h-[18px] w-16 rounded-[2px] opacity-85",
        tone === "accent" && "bg-accent-gradient -rotate-6",
        tone === "mint" && "rotate-3 bg-[#BFE3D3] dark:bg-[#4F8A6E]",
        tone === "sun" && "-rotate-3 bg-[#FFE08A] dark:bg-[#D9B84A]",
        className,
      )}
    />
  );
}
