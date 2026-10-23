import type { ComponentProps } from "react";
import { cn } from "cn";
import { Card } from "@/components/ui/card";

/**
 * 收據式卡片：兩側有打孔缺口，內容用虛線分隔。
 * 用法同 Card；缺口位置以 notchBottom（px）控制。
 */
export function ReceiptCard({ className, children, notchBottom = 44, ...props }: ComponentProps<typeof Card> & { notchBottom?: number }) {
  return (
    <Card className={cn("relative", className)} {...props}>
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-2 size-4 rounded-full border border-border bg-background"
        style={{ bottom: notchBottom }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-2 size-4 rounded-full border border-border bg-background"
        style={{ bottom: notchBottom }}
      />
    </Card>
  );
}

/** 收據上的虛線列表：每一列之間用虛線分隔 */
export function ReceiptList({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col divide-y divide-dashed divide-line border-t border-dashed border-line", className)} {...props} />;
}
