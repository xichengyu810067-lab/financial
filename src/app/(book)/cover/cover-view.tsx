"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Settings } from "lucide-react";
import { NotebookCover } from "@/components/journal/notebook-cover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { coverColorOf } from "@/lib/brand";
import { useLedger, useProfile } from "@/lib/ledger/queries";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

const OPEN_DURATION_MS = 950;

/**
 * 封面：一本筆記本放在桌上。點封面（或按鈕、Enter）播放翻書動畫，
 * 動畫結束導到今天這一頁；系統設定「減少動態」時直接進去。
 */
export function CoverView() {
  const router = useRouter();
  const { data: ledger } = useLedger();
  const { data: profile } = useProfile();
  const reducedMotion = usePrefersReducedMotion();
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    router.prefetch("/today");
  }, [router]);

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => router.push("/today"), OPEN_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [opening, router]);

  if (!ledger || !profile) {
    return <Skeleton className="mx-auto mt-10 h-[544px] w-[420px] max-w-full rounded-[18px]" />;
  }

  const open = () => {
    if (opening) return;
    if (reducedMotion) {
      router.push("/today");
      return;
    }
    setOpening(true);
  };

  const palette = coverColorOf(ledger.cover_color);
  const year = new Date().getFullYear();

  return (
    <div className="grid flex-1 items-center gap-10 py-6 lg:grid-cols-2">
      <div className="book-scene mx-auto" data-opening={opening ? "true" : "false"} style={{ perspective: "1800px" }}>
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 rounded-[8px_18px_18px_8px] sm:rounded-[10px_22px_22px_10px]"
            style={{ backgroundColor: palette.spine }}
          />
          <div
            aria-hidden
            className="paper-page absolute inset-y-2.5 right-2.5 left-5 rounded-r-md px-6 py-8 shadow-[inset_12px_0_18px_rgba(0,0,0,0.08)] sm:left-7"
          >
            <div className="text-[11px] tracking-[0.2em] text-muted-foreground">今天</div>
            <div className="mt-1 font-hand text-[24px] font-bold sm:text-[32px]">翻開就看得到</div>
            <div className="mt-6 grid gap-3">
              <span className="block h-2.5 w-3/4 rounded-full bg-foreground/10" />
              <span className="block h-2.5 w-3/5 rounded-full bg-foreground/10" />
              <span className="block h-2.5 w-2/3 rounded-full bg-foreground/10" />
            </div>
          </div>
          <button
            type="button"
            onClick={open}
            aria-label="翻開帳本"
            className="book-cover relative block cursor-pointer rounded-[8px_18px_18px_8px] text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/40 sm:rounded-[10px_22px_22px_10px]"
          >
            <NotebookCover name={ledger.name} slogan={profile.slogan} material={ledger.cover_material} color={ledger.cover_color} year={year} size="lg" />
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:mx-0">
        <div>
          <h1 className="font-hand text-[34px] leading-tight font-bold sm:text-[40px]">
            輕觸封面，
            <br />
            翻開今天這一頁。
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
            今天存了多少、花了多少、哪裡花過頭，翻開就看得到。數字由系統算，你只要記一筆。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={open} disabled={opening}>
            <BookOpen className="size-5" aria-hidden />
            {opening ? "翻開中…" : "翻開帳本"}
          </Button>
          <Link href="/today" className={buttonVariants({ variant: "ghost", size: "lg" })}>
            跳過動畫
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          封面的顏色與材質可以在
          <Link href="/settings" className="mx-1 inline-flex items-center gap-1 font-bold text-primary underline-offset-4 hover:underline">
            <Settings className="size-3.5" aria-hidden />
            設定頁
          </Link>
          更換。翻書動畫只在進入帳本時播一次；系統設定「減少動態」時直接進入。
        </p>
      </div>
    </div>
  );
}
