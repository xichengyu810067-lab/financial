import type { ComponentProps } from "react";
import { cn } from "cn";

/** 筆記本的一張內頁：米白紙、淡橫線、左側裝訂邊（手機不顯示） */
export function PaperPage({ className, children, ...props }: ComponentProps<"article">) {
  return (
    <article
      className={cn(
        "paper-page relative rounded-[18px] px-4 py-6 shadow-[0_18px_40px_rgba(43,36,32,0.16)] sm:px-8 sm:py-8 md:pl-14",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 hidden w-6 rounded-l-[18px] border-r border-dashed border-line bg-foreground/[0.04] md:block" />
      {children}
    </article>
  );
}
