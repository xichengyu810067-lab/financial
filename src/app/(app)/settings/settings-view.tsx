"use client";

import { useState, useTransition } from "react";
import { Check, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "cn";
import { Field } from "@/components/form-field";
import { WashiTape } from "@/components/journal/washi-tape";
import { PageHeader } from "@/components/page-header";
import { useAccent } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/auth/actions";
import { ACCENTS } from "@/lib/brand";
import { translateDbError } from "@/lib/ledger/errors";
import { useLedger, useProfile, useUpdateLedger, useUpdateProfile } from "@/lib/ledger/queries";
import type { Ledger, Profile } from "@/lib/ledger/types";

export function SettingsView() {
  const { data: ledger } = useLedger();
  const { data: profile } = useProfile();

  if (!ledger || !profile) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-[22px]" />
        <Skeleton className="h-32 w-full rounded-[22px]" />
      </div>
    );
  }

  // key 讓資料重新載入（例如儲存後）時表單以新值重新初始化
  return (
    <SettingsForm
      key={`${ledger.id}:${ledger.name}:${ledger.start_date}:${profile.display_name}:${profile.slogan}`}
      ledger={ledger}
      profile={profile}
    />
  );
}

function SettingsForm({ ledger, profile }: { ledger: Ledger; profile: Profile & { email: string | null } }) {
  const updateLedger = useUpdateLedger();
  const updateProfile = useUpdateProfile();
  const [signingOut, startSignOut] = useTransition();

  const [ledgerName, setLedgerName] = useState(ledger.name);
  const [startDate, setStartDate] = useState(ledger.start_date);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [slogan, setSlogan] = useState(profile.slogan ?? "");

  const saveLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerName.trim()) return toast.error("請輸入帳本名稱");
    if (!startDate) return toast.error("請選擇起始日");
    updateLedger.mutate(
      { id: ledger.id, name: ledgerName.trim(), start_date: startDate },
      { onSuccess: () => toast.success("已儲存帳本設定"), onError: (err) => toast.error(translateDbError(err)) },
    );
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      {
        id: profile.id,
        display_name: displayName.trim() || (profile.email?.split("@")[0] ?? ""),
        slogan: slogan.trim() || null,
      },
      { onSuccess: () => toast.success("已儲存個人資料"), onError: (err) => toast.error(translateDbError(err)) },
    );
  };

  return (
    <>
      <PageHeader title="設定" description="帳本、個人資料與外觀。" />
      <div className="grid gap-6">
        <Card>
          <WashiTape tone="accent" />
          <form onSubmit={saveLedger}>
            <CardHeader>
              <CardTitle>帳本</CardTitle>
              <CardDescription>起始日改變時，所有期初餘額的日期會一起更新。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <Field label="帳本名稱" htmlFor="ledger-name">
                <Input id="ledger-name" value={ledgerName} onChange={(e) => setLedgerName(e.target.value)} maxLength={30} required />
              </Field>
              <Field label="起始日" htmlFor="start-date">
                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </Field>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={updateLedger.isPending}>
                {updateLedger.isPending ? "儲存中…" : "儲存"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <WashiTape tone="sun" />
          <form onSubmit={saveProfile}>
            <CardHeader>
              <CardTitle>個人資料</CardTitle>
              <CardDescription>顯示名稱出現在右上角與問候語；小標語出現在儀表板問候語下方。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <Field label="顯示名稱" htmlFor="display-name">
                <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
              </Field>
              <Field label="Email" htmlFor="email" hint="登入帳號，目前不提供修改">
                <Input id="email" value={profile.email ?? ""} readOnly disabled />
              </Field>
              <Field label="小標語" htmlFor="slogan" hint="給自己的一句話，最多 40 字" className="sm:col-span-2">
                <Input id="slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} maxLength={40} placeholder="例如：每一筆都算數。" className="font-hand text-base" />
              </Field>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "儲存中…" : "儲存"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <AppearanceCard />

        <Card>
          <CardHeader>
            <CardTitle>帳號</CardTitle>
            <CardDescription>登出後需要重新輸入密碼才能進入。</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" disabled={signingOut} onClick={() => startSignOut(() => signOut())}>
              <LogOut className="size-4" aria-hidden />
              {signingOut ? "登出中…" : "登出"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}

/** 外觀：深淺色與主題色貼紙。設定存在這台裝置的瀏覽器。 */
function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();

  const modes = [
    { value: "light", label: "淺色" },
    { value: "dark", label: "深色" },
    { value: "system", label: "跟隨系統" },
  ];

  return (
    <Card>
      <WashiTape tone="mint" />
      <CardHeader>
        <CardTitle>外觀</CardTitle>
        <CardDescription>主題色會套到標誌字、紙膠帶、按鈕與重點；這些設定存在這台裝置。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 pt-4">
        <div className="grid gap-2">
          <span className="text-sm font-bold text-muted-foreground">深淺色</span>
          <div className="inline-flex w-fit gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="深淺色">
            {modes.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={theme === m.value}
                onClick={() => setTheme(m.value)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  theme === m.value ? "bg-card font-bold shadow-paper" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-bold text-muted-foreground">主題色</span>
          <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="主題色">
            {ACCENTS.map((a) => {
              const selected = a.id === accent;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={a.label}
                  title={a.label}
                  onClick={() => setAccent(a.id)}
                  className={cn(
                    "relative size-14 rounded-full border-[3px] shadow-[0_3px_0_var(--line)] transition-transform hover:scale-105",
                    selected ? "border-foreground" : "border-card",
                  )}
                  style={{ backgroundImage: `linear-gradient(to top right, ${a.from}, ${a.to})` }}
                >
                  {selected && (
                    <span className="absolute inset-0 flex items-center justify-center text-[var(--ink-on-accent)]">
                      <Check className="size-5" aria-hidden strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
