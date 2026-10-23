"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentMonth, isValidMonth, shiftMonth } from "@/lib/ledger/entries";

interface MonthSwitcherProps {
  month: string;
  onChange: (month: string) => void;
}

export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  const isCurrent = month === currentMonth();
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon-sm" aria-label="上一個月" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <Input
        type="month"
        value={month}
        onChange={(e) => isValidMonth(e.target.value) && onChange(e.target.value)}
        aria-label="選擇月份"
        className="w-44 rounded-[6px] border-0 bg-highlight text-center font-hand text-[17px] text-accent-foreground"
      />
      <Button variant="outline" size="icon-sm" aria-label="下一個月" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight className="size-4" aria-hidden />
      </Button>
      {!isCurrent && (
        <Button variant="ghost" size="sm" onClick={() => onChange(currentMonth())}>
          本月
        </Button>
      )}
    </div>
  );
}
