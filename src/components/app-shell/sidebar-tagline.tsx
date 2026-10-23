"use client";

import { ClientOnly } from "@/components/client-only";
import { taglineForHour } from "@/lib/greeting";

function Tagline() {
  return <>{taglineForHour(new Date().getHours())}</>;
}

/** 側欄底部依時段變化的一句話（時間在瀏覽器端取得） */
export function SidebarTagline() {
  return (
    <p className="mt-auto ml-2.5 pt-6 font-hand text-[13px] text-muted-foreground">
      <ClientOnly fallback={<span>&nbsp;</span>}>
        <Tagline />
      </ClientOnly>
    </p>
  );
}
