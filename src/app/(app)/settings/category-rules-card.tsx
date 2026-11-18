"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccountSelect } from "@/components/entry/account-select";
import { CategorySelect } from "@/components/entry/category-select";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { translateDbError } from "@/lib/ledger/errors";
import { useCategoryRules, useDeleteCategoryRule, useSaveCategoryRule } from "@/lib/ledger/inbox";
import { useAccounts } from "@/lib/ledger/queries";
import { isBalanceAccount } from "@/lib/ledger/types";

/** 自動分類規則：店名包含某字 → 類別（與付款帳戶）。掃描或匯入發票時先看規則，再看同一家店上次記到哪 */
export function CategoryRulesCard({ ledgerId }: { ledgerId: string }) {
  const { data: accounts } = useAccounts(ledgerId);
  const { data: rules } = useCategoryRules(ledgerId);
  const save = useSaveCategoryRule();
  const remove = useDeleteCategoryRule();
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nameOf = (id: string | null) => accounts?.find((a) => a.id === id)?.name ?? "（已刪除）";
  const categories = (accounts ?? []).filter((a) => a.type === "expense");
  const payAccounts = (accounts ?? []).filter((a) => isBalanceAccount(a) && !a.is_system && !a.is_archived);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return setError("請輸入店名包含的字");
    if (!categoryId) return setError("請選擇類別");
    setError(null);
    try {
      const sortOrder = Math.max(0, ...(rules ?? []).map((r) => r.sort_order)) + 10;
      await save.mutateAsync({ ledgerId, pattern, categoryId, accountId: accountId || null, sortOrder });
      toast.success(`已新增規則「${pattern.trim()}」`);
      setPattern("");
      setCategoryId("");
      setAccountId("");
    } catch (err) {
      setError(translateDbError(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>自動分類規則</CardTitle>
        <CardDescription>
          掃描或匯入發票時，店名包含這些字就自動選好類別；沒有符合的規則，會照同一家店上次記的類別。房租這類每期都有的帳請到
          <Link href="/recurring" className="mx-1 font-bold text-primary underline-offset-4 hover:underline">
            固定支出
          </Link>
          設定。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {rules && rules.length > 0 ? (
          <ul className="grid gap-2">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-sm">
                <span className="flex-1">
                  店名包含「<strong>{rule.pattern}</strong>」→ {nameOf(rule.category_id)}
                  {rule.account_id && <span className="text-muted-foreground">（付款：{nameOf(rule.account_id)}）</span>}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`刪除規則「${rule.pattern}」`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(
                      { ledgerId, id: rule.id },
                      { onSuccess: () => toast.success(`已刪除規則「${rule.pattern}」`), onError: (err) => toast.error(translateDbError(err)) },
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">還沒有規則。例如「全家 → 飲食」「中油 → 交通」。</p>
        )}

        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="店名包含" htmlFor="rule-pattern">
            <Input id="rule-pattern" maxLength={30} placeholder="例如：全家" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          </Field>
          <Field label="類別" htmlFor="rule-category">
            <CategorySelect id="rule-category" categories={categories} value={categoryId} onChange={setCategoryId} />
          </Field>
          <Field label="付款帳戶（可留空）" htmlFor="rule-account">
            <AccountSelect id="rule-account" accounts={payAccounts} value={accountId} onChange={setAccountId} placeholder="不指定" />
          </Field>
          <Button type="submit" variant="outline" disabled={save.isPending}>
            <Plus className="size-4" aria-hidden />
            新增規則
          </Button>
          <FormError message={error ?? undefined} />
        </form>
      </CardContent>
    </Card>
  );
}
