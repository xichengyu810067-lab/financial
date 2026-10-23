"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts, useBalances, useLedger } from "@/lib/ledger/queries";
import { EntryForm } from "./entry-form";
import type { EntrySheetState } from "./entry-sheet-provider";

const TITLES = { new: "記一筆", edit: "編輯交易", copy: "複製交易" } as const;
const DESCRIPTIONS = {
  new: "金額可以直接打算式，例如 120+35。",
  edit: "修改後帳戶餘額會立即更新。",
  copy: "內容已帶入，日期改為今天，存檔後會是一筆新的交易。",
} as const;

interface EntrySheetProps {
  state: EntrySheetState;
  onClose: () => void;
}

export function EntrySheet({ state, onClose }: EntrySheetProps) {
  const { data: ledger } = useLedger();
  const { data: accounts } = useAccounts(ledger?.id);
  const { data: balances } = useBalances(ledger?.id);

  const mode = state.open ? state.mode : "new";

  return (
    <Sheet open={state.open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>{TITLES[mode]}</SheetTitle>
          <SheetDescription>{DESCRIPTIONS[mode]}</SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-6">
          {state.open && ledger && accounts ? (
            <EntryForm
              key={`${state.mode}:${state.entry?.id ?? "new"}:${state.seq}`}
              ledger={ledger}
              accounts={accounts}
              balances={balances}
              mode={state.mode}
              entry={state.entry}
              onDone={onClose}
            />
          ) : (
            <Skeleton className="h-80 w-full" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
