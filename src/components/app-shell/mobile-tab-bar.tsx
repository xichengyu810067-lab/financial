"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, Ellipsis } from "lucide-react";
import { cn } from "cn";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isActivePath, MOBILE_PRIMARY_COUNT, NAV_ITEMS } from "./nav";

/** 手機底部四格：今天、本月、交易、更多（其餘分頁與封面收在底部面板） */
export function MobileTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.slice(0, MOBILE_PRIMARY_COUNT);
  const rest = NAV_ITEMS.slice(MOBILE_PRIMARY_COUNT);
  const restActive = rest.some((item) => isActivePath(pathname, item.href));

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] transition-colors",
      active ? "font-bold text-primary" : "font-medium text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <nav
        aria-label="主選單"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-line bg-card px-2 pt-1 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen} className={tabClass(restActive)}>
          <Ellipsis className="size-5" aria-hidden />
          更多
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-[22px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="pb-2">
            <SheetTitle className="font-hand text-[22px] font-bold">更多</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {rest.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm",
                    active ? "bg-accent font-bold text-accent-foreground" : "bg-card",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
            <Link href="/cover" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
              <BookOpen className="size-4" aria-hidden />
              回到封面
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
