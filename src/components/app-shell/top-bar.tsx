"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/lib/ledger/queries";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

/** 頂欄：手機選單、帳本名稱、使用者選單 */
export function TopBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="開啟選單" />}>
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-4">
          <SheetHeader className="p-0 pb-4">
            <SheetTitle>財報記帳平台</SheetTitle>
          </SheetHeader>
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="min-w-0 flex-1 truncate text-sm font-medium">
        <ClientOnly fallback={<Skeleton className="h-4 w-24" />}>
          <LedgerName />
        </ClientOnly>
      </div>
      <ClientOnly fallback={<Skeleton className="h-8 w-24" />}>
        <UserMenu />
      </ClientOnly>
    </header>
  );
}

function LedgerName() {
  const { data: ledger } = useLedger();
  return <>{ledger?.name ?? ""}</>;
}
