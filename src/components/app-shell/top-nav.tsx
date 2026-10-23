"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { ClientOnly } from "@/components/client-only";
import { Logo } from "@/components/journal/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/lib/ledger/queries";
import { isActivePath, NAV_ITEMS } from "./nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/** 頂欄：標誌字（回封面）、頂部分頁、帳本名稱、深淺色、使用者 */
export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
      <Link href="/cover" aria-label="回到封面" className="shrink-0">
        <Logo />
      </Link>
      <nav aria-label="主選單" className="hidden flex-1 items-center gap-1 md:flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                active
                  ? "bg-accent-gradient font-bold shadow-[0_3px_0_var(--accent-shadow)]"
                  : "font-medium text-foreground/80 hover:bg-card hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden max-w-40 truncate font-hand text-[15px] text-muted-foreground sm:block">
          <ClientOnly fallback={<Skeleton className="h-4 w-20" />}>
            <LedgerName />
          </ClientOnly>
        </span>
        <ThemeToggle />
        <ClientOnly fallback={<Skeleton className="h-8 w-24 rounded-full" />}>
          <UserMenu />
        </ClientOnly>
      </div>
    </header>
  );
}

function LedgerName() {
  const { data: ledger } = useLedger();
  return <>{ledger?.name ?? ""}</>;
}
