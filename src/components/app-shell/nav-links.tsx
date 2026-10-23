"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { NAV_ITEMS } from "./nav";

interface NavLinksProps {
  onNavigate?: () => void;
  className?: string;
}

/** 筆記本索引標籤：每一頁是一張往右伸出的標籤，目前頁面是主題漸層並往右「抽出來」 */
export function NavLinks({ onNavigate, className }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-2.5", className)} aria-label="主選單">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-l-2xl border border-r-0 px-4 py-2.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              active
                ? "ml-2 border-transparent bg-accent-gradient font-bold shadow-[-4px_4px_0_var(--accent-shadow)]"
                : "border-border bg-card text-foreground/85 hover:translate-x-0.5 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
