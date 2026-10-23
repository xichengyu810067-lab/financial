"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { Logo } from "@/components/journal/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/lib/ledger/queries";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/** 頂欄：手機選單、帳本名稱、深淺色切換、使用者選單 */
export function TopBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 px-4 md:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="開啟選單" />}>
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 pt-5 pr-0 pb-6 pl-5">
          <SheetHeader className="p-0 pb-4">
            <SheetTitle>
              <Logo size="sm" />
            </SheetTitle>
          </SheetHeader>
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="min-w-0 flex-1 truncate font-hand text-[15px] text-muted-foreground">
        <ClientOnly fallback={<Skeleton className="h-4 w-24" />}>
          <LedgerName />
        </ClientOnly>
      </div>
      <ThemeToggle />
      <ClientOnly fallback={<Skeleton className="h-8 w-24 rounded-full" />}>
        <UserMenu />
      </ClientOnly>
    </header>
  );
}

function LedgerName() {
  const { data: ledger } = useLedger();
  return <>{ledger?.name ?? ""}</>;
}
