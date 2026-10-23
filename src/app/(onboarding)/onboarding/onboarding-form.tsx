"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AccountIcon } from "@/components/account-icon";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { todayISO } from "@/lib/ledger/format";
import { useAccounts, useCompleteOnboarding, useLedger } from "@/lib/ledger/queries";
import { ACCOUNT_TYPE_LABELS, isBalanceAccount, type Account, type Ledger } from "@/lib/ledger/types";

export function OnboardingForm() {
  const { data: ledger } = useLedger();
  const { data: accounts } = useAccounts(ledger?.id);

  if (!ledger || !accounts) {
    return <Skeleton className="h-96 w-full" />;
  }

  return <OnboardingFormInner key={ledger.id} ledger={ledger} accounts={accounts} />;
}

interface AccountRowState {
  account: Account;
  keep: boolean;
  name: string;
  opening: string;
}

function OnboardingFormInner({ ledger, accounts }: { ledger: Ledger; accounts: Account[] }) {
  const router = useRouter();
  const complete = useCompleteOnboarding();

  const [name, setName] = useState(ledger.name);
  const [startDate, setStartDate] = useState(todayISO());
  const [rows, setRows] = useState<AccountRowState[]>(() =>
    accounts
      .filter((a) => isBalanceAccount(a) && !a.is_system)
      .map((account) => ({ account, keep: true, name: account.name, opening: "" })),
  );
  const [error, setError] = useState<string>();

  const updateRow = (id: string, patch: Partial<AccountRowState>) =>
    setRows((prev) => prev.map((r) => (r.account.id === id ? { ...r, ...patch } : r)));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!name.trim()) return setError("請輸入帳本名稱");
    if (!startDate) return setError("請選擇起始日");
    const kept = rows.filter((r) => r.keep);
    if (kept.length === 0) return setError("至少保留一個帳戶");
    for (const r of kept) {
      if (!r.name.trim()) return setError("帳戶名稱不能空白");
      const n = r.opening === "" ? 0 : Number(r.opening);
      if (!Number.isFinite(n) || n < 0) return setError(`「${r.name}」的期初餘額必須是 0 以上的數字`);
    }
    const names = kept.map((r) => r.name.trim());
    if (new Set(names).size !== names.length) return setError("帳戶名稱不能重複");

    try {
      await complete.mutateAsync({
        name: name.trim(),
        startDate,
        accounts: rows.map((r) => ({
          id: r.account.id,
          name: r.name.trim(),
          keep: r.keep,
          opening_amount: r.keep && r.opening !== "" ? Number(r.opening) : 0,
        })),
      });
      toast.success("帳本設定完成");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗，請再試一次");
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">先把帳本設定好</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          這些之後都能在「設定」與「帳戶」頁修改。期初餘額是你開始記帳那天各帳戶的金額，不確定可以先空著。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>帳本</CardTitle>
          <CardDescription>幫帳本取個名字，並選擇從哪一天開始記。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="帳本名稱" htmlFor="ledger-name">
            <Input id="ledger-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
          </Field>
          <Field label="起始日" htmlFor="start-date" hint="所有期初餘額都會記在這一天">
            <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>帳戶與期初餘額</CardTitle>
          <CardDescription>取消勾選不需要的帳戶；信用卡的期初餘額填目前的卡債金額。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {rows.map((row) => (
            <div
              key={row.account.id}
              className="grid grid-cols-[auto_auto_1fr] items-center gap-3 rounded-lg border p-3 sm:grid-cols-[auto_auto_1fr_11rem]"
            >
              <Checkbox
                checked={row.keep}
                onCheckedChange={(checked) => updateRow(row.account.id, { keep: Boolean(checked) })}
                aria-label={`保留 ${row.name}`}
              />
              <AccountIcon icon={row.account.icon} color={row.account.color} size="sm" />
              <div className="grid gap-1">
                <Input
                  value={row.name}
                  onChange={(e) => updateRow(row.account.id, { name: e.target.value })}
                  disabled={!row.keep}
                  maxLength={30}
                  aria-label="帳戶名稱"
                />
                <span className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[row.account.type]}</span>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="期初餘額"
                value={row.opening}
                onChange={(e) => updateRow(row.account.id, { opening: e.target.value })}
                disabled={!row.keep}
                className="col-span-3 sm:col-span-1"
                aria-label={`${row.name} 期初餘額`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <FormError message={error} />
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={complete.isPending}>
          {complete.isPending ? "儲存中…" : "完成設定，開始記帳"}
        </Button>
      </div>
    </form>
  );
}
