"use client";

import Link from "next/link";
import { Clock, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { Stamp } from "@/components/journal/stamp";
import { Card, CardContent } from "@/components/ui/card";
import type { SpendingAlert } from "@/lib/ledger/alerts";

interface AlertsCardProps {
  alerts: SpendingAlert[];
  isToday: boolean;
  className?: string;
}

const LEVEL_STYLE = {
  red: { box: "bg-expense/10 border-expense", text: "text-expense", bar: "bg-expense", track: "bg-expense/20", Icon: TriangleAlert, label: "花過頭" },
  orange: { box: "bg-warning/10 border-warning", text: "text-warning", bar: "bg-warning", track: "bg-warning/20", Icon: Clock, label: "習慣性超支" },
  large: { box: "bg-accent border-primary", text: "text-primary", bar: "bg-primary", track: "bg-primary/20", Icon: Sparkles, label: "單筆大額" },
} as const;

/** 「今天要注意」：紅色花過頭、單筆大額、橙色習慣性超支；沒有就「今天很乖」 */
export function AlertsCard({ alerts, isToday, className }: AlertsCardProps) {
  return (
    <Card size="sm" className={cn("border-t-[3px]", alerts.length > 0 ? "border-t-warning" : "border-t-income", className)}>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold">{isToday ? "今天要注意" : "那天要注意"}</span>
          <Link href="/categories" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            基準線在「類別」頁設定
          </Link>
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-income/10 px-3 py-3">
            <Stamp size="sm" className="border-income text-income">
              很乖
            </Stamp>
            <div>
              <div className="text-sm font-bold text-income">{isToday ? "今天很乖" : "那天很乖"}</div>
              <div className="text-xs text-muted-foreground">每個類別都在基準線內，沒有單筆大額。</div>
            </div>
          </div>
        ) : (
          <ul className="grid gap-2">
            {alerts.map((alert) => {
              const style = LEVEL_STYLE[alert.level];
              const Icon = style.Icon;
              const width = alert.ratio === null ? null : Math.min(100, Math.round(alert.ratio * 100));
              return (
                <li key={`${alert.level}:${alert.categoryId}:${alert.title}`} className={cn("flex gap-3 rounded-xl border-l-4 px-3 py-2.5", style.box)}>
                  <Icon className={cn("mt-0.5 size-4 shrink-0", style.text)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className={cn("text-sm font-bold", style.text)}>{alert.title}</span>
                      <span className="text-[11px] text-muted-foreground">{style.label}</span>
                    </div>
                    {width !== null && (
                      <div aria-hidden className={cn("mt-1.5 h-1.5 overflow-hidden rounded-full", style.track)}>
                        <span className={cn("block h-full rounded-full", style.bar)} style={{ width: `${width}%` }} />
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">{alert.advice}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
