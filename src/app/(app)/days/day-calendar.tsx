"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDailySummary } from "@/lib/ledger/days";
import { monthLabel, monthRange, shiftMonth } from "@/lib/ledger/entries";

interface DayCalendarProps {
  ledgerId: string;
  /** 目前這一頁的日期 */
  date: string;
  today: string;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 跳到某一天：月曆彈窗，有記帳的日子有小點，明天以後不能選 */
export function DayCalendar({ ledgerId, date, today, onSelect }: DayCalendarProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(date.slice(0, 7));
  const { start, end } = monthRange(viewMonth);
  const { data: days } = useDailySummary(ledgerId, start, end);
  const counts = new Map((days ?? []).map((d) => [d.day, d.entryCount]));

  const [year, month] = viewMonth.split("-").map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${viewMonth}-${String(i + 1).padStart(2, "0")}`),
  ];
  const canGoNext = viewMonth < today.slice(0, 7);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" aria-label="跳到某一天" />}>
        <CalendarDays className="size-4" aria-hidden />
        <span className="hidden sm:inline">跳到某一天</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2 p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" aria-label="上個月" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="font-hand text-[16px] font-bold">{monthLabel(viewMonth)}</span>
          <Button variant="ghost" size="icon-sm" aria-label="下個月" disabled={!canGoNext} onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel(viewMonth)}>
          {cells.map((cell, index) => {
            if (!cell) return <span key={`empty-${index}`} aria-hidden />;
            const future = cell > today;
            const selected = cell === date;
            const isToday = cell === today;
            const hasEntries = (counts.get(cell) ?? 0) > 0;
            return (
              <button
                key={cell}
                type="button"
                role="gridcell"
                disabled={future}
                aria-selected={selected}
                aria-label={`${cell}${hasEntries ? "，有交易" : ""}`}
                onClick={() => {
                  setOpen(false);
                  onSelect(cell);
                }}
                className={cn(
                  "relative flex h-9 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                  future ? "text-muted-foreground/40" : "hover:bg-muted",
                  selected && "bg-accent-gradient font-bold shadow-[0_2px_0_var(--accent-shadow)]",
                  !selected && isToday && "ring-1 ring-primary",
                )}
              >
                {Number(cell.slice(8, 10))}
                {hasEntries && <span aria-hidden className={cn("absolute bottom-1 size-1 rounded-full", selected ? "bg-[var(--ink-on-accent)]" : "bg-primary")} />}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>有小點的日子有記帳</span>
          <button
            type="button"
            className="font-bold text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setOpen(false);
              onSelect(today);
            }}
          >
            回到今天
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
