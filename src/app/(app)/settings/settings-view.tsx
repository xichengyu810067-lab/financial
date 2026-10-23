"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/auth/actions";
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
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // key 讓資料重新載入（例如儲存後）時表單以新值重新初始化
  return <SettingsForm key={`${ledger.id}:${ledger.name}:${ledger.start_date}:${profile.display_name}`} ledger={ledger} profile={profile} />;
}

function SettingsForm({ ledger, profile }: { ledger: Ledger; profile: Profile & { email: string | null } }) {
  const updateLedger = useUpdateLedger();
  const updateProfile = useUpdateProfile();
  const [signingOut, startSignOut] = useTransition();

  const [ledgerName, setLedgerName] = useState(ledger.name);
  const [startDate, setStartDate] = useState(ledger.start_date);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");

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
      { id: profile.id, display_name: displayName.trim() || (profile.email?.split("@")[0] ?? "") },
      { onSuccess: () => toast.success("已儲存個人資料"), onError: (err) => toast.error(translateDbError(err)) },
    );
  };

  return (
    <>
      <PageHeader title="設定" description="帳本與個人資料。" />
      <div className="grid gap-6">
        <Card>
          <form onSubmit={saveLedger}>
            <CardHeader>
              <CardTitle>帳本</CardTitle>
              <CardDescription>起始日改變時，所有期初餘額的日期會一起更新。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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
          <form onSubmit={saveProfile}>
            <CardHeader>
              <CardTitle>個人資料</CardTitle>
              <CardDescription>顯示名稱會出現在右上角。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="顯示名稱" htmlFor="display-name">
                <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
              </Field>
              <Field label="Email" htmlFor="email" hint="登入帳號，目前不提供修改">
                <Input id="email" value={profile.email ?? ""} readOnly disabled />
              </Field>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "儲存中…" : "儲存"}
              </Button>
            </CardFooter>
          </form>
        </Card>

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
