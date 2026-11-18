"use client";

import { useState } from "react";
import { Plus, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccountSelect } from "@/components/entry/account-select";
import { CategorySelect } from "@/components/entry/category-select";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD } from "@/lib/ledger/format";
import { useConfirmInbox } from "@/lib/ledger/inbox";
import {
  SOURCE_LABELS,
  confirmPayload,
  inboxTitle,
  initialDraft,
  invoiceLines,
  isInvoice,
  splitsFromInvoice,
  splitsTotal,
  validateDraft,
  type ConfirmDraft,
  type InboxItem,
  type InboxSource,
  type Split,
} from "@/lib/ledger/inbox-model";
import { isBalanceAccount, type Account } from "@/lib/ledger/types";

interface InboxConfirmDialogProps {
  /** 要確認的項目；null 代表關閉 */
  item: InboxItem | null;
  onClose: () => void;
  ledgerId: string;
  accounts: Account[];
}

/** 確認一筆待確認項目：可改日期、帳戶、類別、金額（固定支出），也可以拆成多筆（發票拆品項） */
export function InboxConfirmDialog({ item, onClose, ledgerId, accounts }: InboxConfirmDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {item && <ConfirmForm key={item.id} item={item} onClose={onClose} ledgerId={ledgerId} accounts={accounts} />}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmForm({ item, onClose, ledgerId, accounts }: { item: InboxItem; onClose: () => void; ledgerId: string; accounts: Account[] }) {
  const confirm = useConfirmInbox();
  const [draft, setDraft] = useState<ConfirmDraft>(() => initialDraft(item));
  const [error, setError] = useState<string | null>(null);

  const balanceAccounts = accounts.filter(
    (a) => isBalanceAccount(a) && !a.is_system && (!a.is_archived || a.id === draft.fromAccountId || a.id === draft.toAccountId),
  );
  const categories = accounts.filter((a) => a.type === (item.kind === "income" ? "revenue" : "expense"));
  const invoice = isInvoice(item);
  const lines = invoiceLines(item);
  const multi = draft.splits.length > 1;
  const total = splitsTotal(draft.splits);

  const setSplit = (index: number, patch: Partial<Split>) =>
    setDraft((d) => ({ ...d, splits: d.splits.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateDraft(item, draft);
    if (problem) return setError(problem);
    setError(null);
    try {
      const ids = await confirm.mutateAsync({ ledgerId, itemId: item.id, payload: confirmPayload(item, draft) });
      toast.success(ids.length > 1 ? `已入帳 ${ids.length} 筆` : "已入帳");
      onClose();
    } catch (err) {
      setError(translateDbError(err));
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>確認「{inboxTitle(item)}」</DialogTitle>
        <DialogDescription>
          {SOURCE_LABELS[item.source as InboxSource]}・{formatTWD(Number(item.amount))}
          {item.invoice_no && `・發票 ${item.invoice_no}`}
          {invoice ? "。拆成多筆時，合計要等於發票金額。" : item.source === "recurring" ? "。金額這次不一樣的話可以直接改。" : ""}
        </DialogDescription>
      </DialogHeader>

      <FormError message={error ?? undefined} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="日期" htmlFor="inbox-date">
          <Input id="inbox-date" type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
        </Field>
        {item.kind !== "income" && (
          <Field label={item.kind === "transfer" ? "轉出帳戶" : "付款帳戶"} htmlFor="inbox-from">
            <AccountSelect id="inbox-from" accounts={balanceAccounts} value={draft.fromAccountId} onChange={(v) => setDraft((d) => ({ ...d, fromAccountId: v }))} />
          </Field>
        )}
        {item.kind !== "expense" && (
          <Field label={item.kind === "transfer" ? "轉入帳戶" : "存入帳戶"} htmlFor="inbox-to">
            <AccountSelect id="inbox-to" accounts={balanceAccounts} value={draft.toAccountId} onChange={(v) => setDraft((d) => ({ ...d, toAccountId: v }))} />
          </Field>
        )}
      </div>

      {lines.length > 0 && (
        <details className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">發票品項（{lines.length} 項）</summary>
          <ul className="mt-2 grid gap-1">
            {lines.map((line, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">
                  {line.name}
                  {line.qty !== 1 && ` ×${line.qty}`}
                </span>
                <span className="tabular-nums">{formatTWD(line.qty * line.price)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="grid gap-3">
        {draft.splits.map((split, i) => {
          const n = multi ? `第 ${i + 1} 筆的` : "";
          return (
            <fieldset key={i} className={multi ? "grid gap-3 rounded-xl border border-dashed border-line p-3" : "grid gap-3"}>
              {multi && (
                <legend className="flex w-full items-center justify-between px-1 text-xs font-bold text-muted-foreground">
                  第 {i + 1} 筆
                </legend>
              )}
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                {item.kind !== "transfer" ? (
                  <Field label={`${n}類別`} htmlFor={`inbox-cat-${i}`}>
                    <CategorySelect id={`inbox-cat-${i}`} categories={categories} value={split.categoryId} onChange={(v) => setSplit(i, { categoryId: v })} />
                  </Field>
                ) : (
                  <span />
                )}
                <Field label={`${n}金額`} htmlFor={`inbox-amount-${i}`}>
                  <Input
                    id={`inbox-amount-${i}`}
                    inputMode="decimal"
                    value={split.amount}
                    onChange={(e) => setSplit(i, { amount: e.target.value })}
                    disabled={invoice && !multi}
                  />
                </Field>
              </div>
              <div className="flex items-end gap-2">
                <Field label={`${n}備註（可留空）`} htmlFor={`inbox-memo-${i}`} className="flex-1">
                  <Input id={`inbox-memo-${i}`} maxLength={100} placeholder={item.memo ?? ""} value={split.memo} onChange={(e) => setSplit(i, { memo: e.target.value })} />
                </Field>
                {multi && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`刪掉第 ${i + 1} 筆`}
                    onClick={() => setDraft((d) => ({ ...d, splits: d.splits.filter((_, j) => j !== i) }))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>

      {item.kind !== "transfer" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDraft((d) => ({ ...d, splits: [...d.splits, { categoryId: d.splits[0]?.categoryId ?? "", amount: "", memo: "" }] }))}
          >
            <Plus className="size-4" aria-hidden />
            再拆一筆
          </Button>
          {lines.length > 1 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, splits: splitsFromInvoice(item) }))}>
              <Scissors className="size-4" aria-hidden />
              依品項拆開
            </Button>
          )}
          {multi && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
              合計 {formatTWD(total)}
              {invoice && ` / 發票 ${formatTWD(Number(item.amount))}`}
            </span>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={confirm.isPending}>
          取消
        </Button>
        <Button type="submit" disabled={confirm.isPending}>
          {confirm.isPending ? "入帳中…" : multi ? `確認入帳 ${draft.splits.length} 筆` : "確認入帳"}
        </Button>
      </DialogFooter>
    </form>
  );
}
