"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  customPeriod,
  isValidISODate,
  periodForQuickOption,
  periodLabel,
  previousPeriod,
  shiftPeriod,
  type Period,
  type PeriodPreset,
} from "@/lib/ledger/period";

interface PeriodPickerProps {
  period: Period;
  /** 今天（YYYY-MM-DD），決定「本月」「本季」「今年」 */
  today: string;
  onChange: (period: Period) => void;
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "month", label: "月" },
  { value: "quarter", label: "季" },
  { value: "year", label: "年" },
  { value: "custom", label: "自訂" },
];

/** 期間選擇器：月／季／年／自訂的分段按鈕 + 依目前長度往前後移 + 自訂起迄日 */
export function PeriodPicker({ period, today, onChange }: PeriodPickerProps) {
  const pick = (preset: PeriodPreset) => {
    if (preset === "custom") onChange({ ...period, preset: "custom" });
    else if (preset === "month") onChange(periodForQuickOption("this-month", today));
    else if (preset === "quarter") onChange(periodForQuickOption("this-quarter", today));
    else onChange(periodForQuickOption("this-year", today));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div role="radiogroup" aria-label="期間長度" className="inline-flex rounded-full border border-line bg-card p-0.5">
        {PRESETS.map((preset) => {
          const active = preset.value === period.preset;
          return (
            <button
              key={preset.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(preset.value)}
              className={cn(
                "h-8 rounded-full px-3.5 text-sm transition-colors",
                active ? "bg-foreground font-bold text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label="上一期" onClick={() => onChange(shiftPeriod(period, -1))}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="inline-block min-w-36 px-2 py-1 text-center font-hand text-[18px] font-bold">{periodLabel(period)}</span>
        <Button variant="outline" size="icon-sm" aria-label="下一期" onClick={() => onChange(shiftPeriod(period, 1))}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      {period.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={period.from}
            max={period.to}
            aria-label="起日"
            className="h-8 w-38 text-sm"
            onChange={(e) => isValidISODate(e.target.value) && onChange(customPeriod(e.target.value, period.to))}
          />
          <span className="text-muted-foreground">～</span>
          <Input
            type="date"
            value={period.to}
            min={period.from}
            aria-label="迄日"
            className="h-8 w-38 text-sm"
            onChange={(e) => isValidISODate(e.target.value) && onChange(customPeriod(period.from, e.target.value))}
          />
        </div>
      )}

      <span className="text-xs text-muted-foreground">上期：{periodLabel(previousPeriod(period))}</span>
    </div>
  );
}
