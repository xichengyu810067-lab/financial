"use client";

import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICON_NAMES, ICONS, LedgerIcon, iconLabel } from "@/lib/ledger/icons";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  id?: string;
}

export function IconPicker({ value, onChange, id }: IconPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button id={id} type="button" variant="outline" className="justify-start" />}>
        <LedgerIcon icon={value} className="size-4" aria-hidden />
        {iconLabel(value) ?? "選擇圖示"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="grid grid-cols-6 gap-1" role="listbox" aria-label="圖示">
          {ICON_NAMES.map((name) => {
            const selected = name === value;
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={selected}
                title={ICONS[name].label}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-10 items-center justify-center rounded-md transition-colors hover:bg-accent",
                  selected && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <LedgerIcon icon={name} className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
