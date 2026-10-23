"use client";

import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntrySheet } from "@/components/entry/entry-sheet-provider";

/** 全站固定的「記一筆」：手機底部置中、桌機右下角，像一支筆蓋 */
export function AddEntryButton() {
  const { openNew } = useEntrySheet();
  return (
    <Button
      size="lg"
      onClick={openNew}
      className="fixed bottom-5 left-1/2 z-40 h-14 -translate-x-1/2 px-6 text-[17px] font-black shadow-[0_6px_0_var(--accent-shadow),0_12px_28px_rgba(43,36,32,0.18)] md:bottom-8 md:left-auto md:right-8 md:translate-x-0"
      aria-label="記一筆"
    >
      <PenLine className="size-5" aria-hidden />
      記一筆
    </Button>
  );
}
