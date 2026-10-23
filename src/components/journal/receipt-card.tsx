import type { ComponentProps } from "react";
import { cn } from "cn";

/** 收據式列表：每一列之間用虛線分隔（用在交易清單、最近交易、明細面板） */
export function ReceiptList({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col divide-y divide-dashed divide-line border-t border-dashed border-line", className)} {...props} />;
}
