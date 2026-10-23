import Link from "next/link";
import { Logo } from "@/components/journal/logo";
import { SidebarTagline } from "./sidebar-tagline";
import { NavLinks } from "./nav-links";

/** 桌機左側：標誌字 + 索引標籤 + 一句小話 */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col pt-7 pb-7 pl-6 md:flex">
      <Link href="/dashboard" className="ml-2.5 mb-5 inline-block w-fit">
        <Logo />
      </Link>
      <NavLinks />
      <SidebarTagline />
    </aside>
  );
}
