"use client";

import { cn } from "cn";
import { COLOR_NAMES, COLORS } from "@/lib/ledger/colors";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="顏色">
      {COLOR_NAMES.map((name) => {
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            title={COLORS[name].label}
            onClick={() => onChange(name)}
            className={cn(
              "size-7 rounded-full transition-transform",
              COLORS[name].dot,
              selected ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-105",
            )}
          />
        );
      })}
    </div>
  );
}
