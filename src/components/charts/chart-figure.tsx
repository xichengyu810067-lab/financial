import type { ReactNode } from "react";
import { cn } from "cn";

interface ChartFigureProps {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

/** 報表上方放圖用的小框：一行標題與說明，底下是圖；比卡片輕，才不會卡片套卡片 */
export function ChartFigure({ title, description, className, children }: ChartFigureProps) {
  return (
    <figure className={cn("grid content-start gap-2 rounded-xl bg-muted/40 p-3", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-bold">{title}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </figcaption>
      {children}
    </figure>
  );
}
