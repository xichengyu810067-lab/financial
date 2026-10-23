"use client";

import { useRef, useState } from "react";
import { ArrowLeftRight, Trash } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evaluateAmount } from "@/lib/ledger/amount-expr";
import { linesForEntry, useDeleteEntries, useSaveEntry, type Entry, type SimpleKind } from "@/lib/ledger/entries";
import { translateDbError } from "@/lib/ledger/errors";
import { todayISO, yesterdayISO } from "@/lib/ledger/format";
import type { Line } from "@/lib/ledger/posting";
import { readLastAccounts, writeLastAccounts } from "@/lib/ledger/preferences";
import { isBalanceAccount, type Account, type AccountBalance, type Ledger } from "@/lib/ledger/types";
import { AccountSelect } from "./account-select";
import { AmountInput } from "./amount-input";
import { CategorySelect } from "./category-select";
import { PostingPreview } from "./posting-preview";

interface EntryFormProps {
  ledger: Ledger;
  accounts: Account[];
  balances?: Map<string, AccountBalance>;
  mode: "new" | "edit" | "copy";
  entry?: Entry;
  onDone: () => void;
}

interface FormState {
  kind: SimpleKind;
  amount: string;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  categoryId: string;
  memo: string;
}

const KINDS: { value: SimpleKind; label: string }[] = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "轉帳" },
];

function initialState(mode: EntryFormProps["mode"], entry: Entry | undefined, ledgerId: string): FormState {
  if (entry && mode !== "new") {
    const kind: SimpleKind = entry.kind === "income" || entry.kind === "transfer" ? entry.kind : "expense";
    return {
      kind,
      amount: String(entry.amount),
      date: mode === "copy" ? todayISO() : entry.entry_date,
      fromAccountId: entry.from_account_id ?? "",
      toAccountId: entry.to_account_id ?? "",
      categoryId: entry.category_id ?? "",
      memo: entry.memo ?? "",
    };
  }
  const last = readLastAccounts(ledgerId);
  return {
    kind: "expense",
    amount: "",
    date: todayISO(),
    fromAccountId: last.expenseFrom ?? "",
    toAccountId: last.incomeTo ?? "",
    categoryId: "",
    memo: "",
  };
}

export function EntryForm({ ledger, accounts, balances, mode, entry, onDone }: EntryFormProps) {
  const [form, setForm] = useState<FormState>(() => initialState(mode, entry, ledger.id));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const save = useSaveEntry();
  const remove = useDeleteEntries();

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const nameOf = (id: string) => accountsById.get(id)?.name ?? "？";

  const balanceAccounts = accounts.filter(
    (a) => isBalanceAccount(a) && !a.is_system && (!a.is_archived || a.id === form.fromAccountId || a.id === form.toAccountId),
  );
  const categoryType = form.kind === "income" ? "revenue" : "expense";
  const categories = accounts.filter((a) => a.type === categoryType);

  const amountResult = evaluateAmount(form.amount);

  let previewLines: Line[] | null = null;
  if (amountResult.ok) {
    try {
      previewLines = linesForEntry({
        kind: form.kind,
        amount: amountResult.value,
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        categoryId: form.categoryId,
        accountsById,
      });
    } catch {
      previewLines = null;
    }
  }

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const changeKind = (kind: SimpleKind) =>
    setForm((f) => {
      const last = readLastAccounts(ledger.id);
      let from = f.fromAccountId;
      let to = f.toAccountId;
      if (kind === "expense" && !from) from = last.expenseFrom ?? "";
      if (kind === "income" && !to) to = last.incomeTo ?? "";
      if (kind === "transfer") {
        // 轉帳優先用上次轉帳的帳戶；兩邊不能相同，相同就清空轉入讓使用者選
        from = last.transferFrom ?? from;
        to = last.transferTo ?? to;
        if (from && from === to) to = "";
      }
      const category = accountsById.get(f.categoryId);
      const keepCategory =
        category && ((kind === "expense" && category.type === "expense") || (kind === "income" && category.type === "revenue"));
      return { ...f, kind, fromAccountId: from, toAccountId: to, categoryId: keepCategory ? f.categoryId : "" };
    });

  const validate = (): string | null => {
    if (!amountResult.ok) return amountResult.error;
    if (!form.date) return "請選擇日期";
    if (form.kind === "expense" && !form.fromAccountId) return "請選擇付款帳戶";
    if (form.kind === "income" && !form.toAccountId) return "請選擇存入帳戶";
    if (form.kind === "transfer") {
      if (!form.fromAccountId) return "請選擇轉出帳戶";
      if (!form.toAccountId) return "請選擇轉入帳戶";
      if (form.fromAccountId === form.toAccountId) return "轉出與轉入帳戶不能相同";
    }
    if (form.kind !== "transfer" && !form.categoryId) return "請選擇類別";
    if (form.memo.length > 100) return "備註最多 100 字";
    return null;
  };

  const submit = async (andNew: boolean) => {
    setSubmitted(true);
    const problem = validate();
    if (problem || !amountResult.ok) {
      setError(problem ?? "請檢查輸入");
      return;
    }
    setError(undefined);
    try {
      await save.mutateAsync({
        id: mode === "edit" ? entry?.id : undefined,
        ledgerId: ledger.id,
        kind: form.kind,
        date: form.date,
        amount: amountResult.value,
        fromAccountId: form.fromAccountId || null,
        toAccountId: form.toAccountId || null,
        categoryId: form.categoryId || null,
        memo: form.memo,
        accountsById,
      });
      writeLastAccounts(
        ledger.id,
        form.kind === "expense"
          ? { expenseFrom: form.fromAccountId }
          : form.kind === "income"
            ? { incomeTo: form.toAccountId }
            : { transferFrom: form.fromAccountId, transferTo: form.toAccountId },
      );
      toast.success(mode === "edit" ? "已更新交易" : "已記一筆");
      if (andNew) {
        setForm((f) => ({ ...f, amount: "", categoryId: "", memo: "" }));
        setSubmitted(false);
        amountRef.current?.focus();
      } else {
        onDone();
      }
    } catch (err) {
      setError(translateDbError(err));
    }
  };

  const confirmRemove = async () => {
    if (!entry) return;
    try {
      await remove.mutateAsync({ ledgerId: ledger.id, ids: [entry.id] });
      toast.success("已刪除交易");
      setConfirmDelete(false);
      onDone();
    } catch (err) {
      toast.error(translateDbError(err));
    }
  };

  const busy = save.isPending || remove.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
      className="grid gap-4"
    >
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="交易種類">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={form.kind === k.value}
            onClick={() => changeKind(k.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              form.kind === k.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Field label="金額" htmlFor="entry-amount">
        <AmountInput id="entry-amount" value={form.amount} onChange={(v) => patch({ amount: v })} inputRef={amountRef} showError={submitted} />
      </Field>

      <Field label="日期" htmlFor="entry-date">
        <div className="flex gap-2">
          <Input id="entry-date" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} required className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={() => patch({ date: todayISO() })}>
            今天
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => patch({ date: yesterdayISO() })}>
            昨天
          </Button>
        </div>
      </Field>

      {form.kind === "expense" && (
        <Field label="付款帳戶" htmlFor="entry-from">
          <AccountSelect id="entry-from" accounts={balanceAccounts} balances={balances} value={form.fromAccountId} onChange={(id) => patch({ fromAccountId: id })} />
        </Field>
      )}
      {form.kind === "income" && (
        <Field label="存入帳戶" htmlFor="entry-to">
          <AccountSelect id="entry-to" accounts={balanceAccounts} balances={balances} value={form.toAccountId} onChange={(id) => patch({ toAccountId: id })} />
        </Field>
      )}
      {form.kind === "transfer" && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label="轉出帳戶" htmlFor="entry-from">
            <AccountSelect id="entry-from" accounts={balanceAccounts} balances={balances} value={form.fromAccountId} onChange={(id) => patch({ fromAccountId: id })} />
          </Field>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mb-0.5"
            aria-label="交換轉出與轉入帳戶"
            title="交換"
            onClick={() => patch({ fromAccountId: form.toAccountId, toAccountId: form.fromAccountId })}
          >
            <ArrowLeftRight className="size-4" aria-hidden />
          </Button>
          <Field label="轉入帳戶" htmlFor="entry-to">
            <AccountSelect id="entry-to" accounts={balanceAccounts} balances={balances} value={form.toAccountId} onChange={(id) => patch({ toAccountId: id })} />
          </Field>
        </div>
      )}

      {form.kind !== "transfer" && (
        <Field label="類別" htmlFor="entry-category">
          <CategorySelect id="entry-category" categories={categories} value={form.categoryId} onChange={(id) => patch({ categoryId: id })} />
        </Field>
      )}

      <Field label="備註" htmlFor="entry-memo" hint="選填，最多 100 字">
        <Input id="entry-memo" value={form.memo} onChange={(e) => patch({ memo: e.target.value })} maxLength={100} placeholder="例如：午餐、10 月房租" />
      </Field>

      <PostingPreview lines={previewLines} nameOf={nameOf} />

      <FormError message={error} />

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {mode === "edit" && (
          <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
            <Trash className="size-4" aria-hidden />
            刪除
          </Button>
        )}
        {mode !== "edit" && (
          <Button type="button" variant="outline" onClick={() => void submit(true)} disabled={busy}>
            儲存並再記一筆
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {save.isPending ? "儲存中…" : "儲存"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="刪除這筆交易？"
        description="刪除後帳戶餘額會立即還原，無法復原。"
        confirmLabel="刪除"
        destructive
        pending={remove.isPending}
        onConfirm={() => void confirmRemove()}
      />
    </form>
  );
}
