"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/auth/actions";
import { useProfile } from "@/lib/ledger/queries";

export function UserMenu() {
  const router = useRouter();
  const { data: profile, isPending } = useProfile();
  const [signingOut, startSignOut] = useTransition();

  if (isPending) return <Skeleton className="h-8 w-24" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <UserRound className="size-4" aria-hidden />
        <span className="max-w-32 truncate">{profile?.display_name ?? "使用者"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="truncate">{profile?.email ?? ""}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="size-4" aria-hidden />
          設定
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={() => startSignOut(() => signOut())}>
          <LogOut className="size-4" aria-hidden />
          {signingOut ? "登出中…" : "登出"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
