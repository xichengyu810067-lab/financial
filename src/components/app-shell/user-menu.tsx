"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Barcode, BookOpen, LogOut, ScanLine, Settings } from "lucide-react";
import { CarrierBarcodeDialog } from "@/components/inbox/carrier-barcode";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignOut } from "@/lib/auth/use-sign-out";
import { useProfile } from "@/lib/ledger/queries";

export function UserMenu() {
  const router = useRouter();
  const { data: profile, isPending } = useProfile();
  const { signingOut, signOut } = useSignOut();
  const [showBarcode, setShowBarcode] = useState(false);

  if (isPending) return <Skeleton className="h-8 w-24 rounded-full" />;

  const name = profile?.display_name ?? "使用者";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="secondary" size="sm" className="bg-card pl-1 ring-1 ring-border hover:bg-muted" />}>
          <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full bg-foreground text-[12px] font-black text-background">
            {initial}
          </span>
          <span className="max-w-32 truncate">{name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">{profile?.email ?? ""}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/cover")}>
            <BookOpen className="size-4" aria-hidden />
            回到封面
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowBarcode(true)}>
            <Barcode className="size-4" aria-hidden />
            出示手機條碼
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/scan")}>
            <ScanLine className="size-4" aria-hidden />
            掃發票
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="size-4" aria-hidden />
            設定
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={signOut}>
            <LogOut className="size-4" aria-hidden />
            {signingOut ? "登出中…" : "登出"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CarrierBarcodeDialog open={showBarcode} onOpenChange={setShowBarcode} />
    </>
  );
}
