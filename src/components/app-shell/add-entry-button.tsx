"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntrySheet } from "@/components/entry/entry-sheet-provider";

/** 全站固定的「記一筆」按鈕：手機底部置中、桌機右下角 */
export function AddEntryButton() {
  const { openNew } = useEntrySheet();
  return (
    <Button
      size="lg"
      onClick={openNew}
      className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full px-5 shadow-lg md:bottom-8 md:left-auto md:right-8 md:translate-x-0"
      aria-label="記一筆"
    >
      <Plus className="size-5" aria-hidden />
      記一筆
    </Button>
  );
}
