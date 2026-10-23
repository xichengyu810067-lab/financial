"use client";

import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntrySheet } from "@/components/entry/entry-sheet-provider";

/** 全站固定的「記一筆」：手機在底部分頁列上方靠右、桌機右下角 */
export function AddEntryButton() {
  const { openNew } = useEntrySheet();
  return (
    <Button
      size="lg"
      onClick={openNew}
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 h-14 px-6 text-[17px] font-black shadow-[0_6px_0_var(--accent-shadow),0_12px_28px_rgba(43,36,32,0.18)] md:right-8 md:bottom-8"
      aria-label="記一筆"
    >
      <PenLine className="size-5" aria-hidden />
      記一筆
    </Button>
  );
}
