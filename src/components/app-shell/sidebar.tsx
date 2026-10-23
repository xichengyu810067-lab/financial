import Link from "next/link";
import { NavLinks } from "./nav-links";

/** 桌機左側導覽列（靜態外殼） */
export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center px-5">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          財報記帳平台
        </Link>
      </div>
      <div className="flex-1 px-3 py-2">
        <NavLinks />
      </div>
    </aside>
  );
}
