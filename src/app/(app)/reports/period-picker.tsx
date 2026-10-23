"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  customPeriod,
  isValidISODate,
  periodForQuickOption,
  periodLabel,
  previousPeriod,
  QUICK_OPTIONS,
  quickOptionOf,
  shiftPeriod,
  type Period,
  type QuickOption,
} from "@/lib/ledger/period";

interface PeriodPickerProps {
  period: Period;
  /** 今天（YYYY-MM-DD），決定「本月」「上季」等快速選項 */
  today: string;
  onChange: (period: Period) => void;
}

/** 期間選擇器：快速選項 + 依目前長度往前後移 + 自訂起迄日 */
export function PeriodPicker({ period, today, onChange }: PeriodPickerProps) {
  const quick = quickOptionOf(period, today);

  const pick = (value: QuickOption) => {
    if (value === "custom") onChange({ ...period, preset: "custom" });
    else onChange(periodForQuickOption(value, today));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Select value={quick} items={QUICK_OPTIONS} onValueChange={(value) => pick(value as QuickOption)}>
        <SelectTrigger aria-label="期間" className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUICK_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label="上一期" onClick={() => onChange(shiftPeriod(period, -1))}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="inline-block min-w-40 rounded-[6px] bg-highlight px-3 py-1 text-center font-hand text-[17px] text-accent-foreground">
          {periodLabel(period)}
        </span>
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
