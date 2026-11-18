"use client";

import { useState } from "react";
import { cn } from "cn";
import { AccountSelect } from "@/components/entry/account-select";
import { CategorySelect } from "@/components/entry/category-select";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { translateDbError } from "@/lib/ledger/errors";
import { todayISO } from "@/lib/ledger/format";
import { useSaveRecurringRule, type RecurringRule } from "@/lib/ledger/inbox";
import { WEEKDAY_LABELS, describeSchedule, recurrenceOnOrAfter, type Frequency, type Schedule } from "@/lib/ledger/recurrence";
import { isBalanceAccount, type Account } from "@/lib/ledger/types";

type Kind = "expense" | "income" | "transfer";

interface RecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: string;
  accounts: Account[];
  /** 編輯時傳入 */
  rule?: RecurringRule;
}

/** 新增／編輯固定支出：名稱、種類、金額、帳戶與類別、週期、第一次（下次）日期 */
export function RecurringDialog({ open, onOpenChange, ledgerId, accounts, rule }: RecurringDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open && <RecurringForm key={rule?.id ?? "new"} onClose={() => onOpenChange(false)} ledgerId={ledgerId} accounts={accounts} rule={rule} />}
      </DialogContent>
    </Dialog>
  );
}

function RecurringForm({ onClose, ledgerId, accounts, rule }: { onClose: () => void; ledgerId: string; accounts: Account[]; rule?: RecurringRule }) {
  const save = useSaveRecurringRule();
  const [name, setName] = useState(rule?.name ?? "");
  const [kind, setKind] = useState<Kind>((rule?.kind as Kind) ?? "expense");
  const [amount, setAmount] = useState(rule ? String(rule.amount) : "");
  const [varies, setVaries] = useState(rule?.amount_varies ?? false);
  const [fromId, setFromId] = useState(rule?.from_account_id ?? "");
  const [toId, setToId] = useState(rule?.to_account_id ?? "");
  const [categoryId, setCategoryId] = useState(rule?.category_id ?? "");
  const [frequency, setFrequency] = useState<Frequency>((rule?.frequency as Frequency) ?? "monthly");
  const [day, setDay] = useState(String(rule?.day_of_month ?? new Date().getDate()));
  const [weekday, setWeekday] = useState(rule?.weekday ?? new Date().getDay());
  const [month, setMonth] = useState(String(rule?.month_of_year ?? new Date().getMonth() + 1));
  const [memo, setMemo] = useState(rule?.memo ?? "");
  const [error, setError] = useState<string | null>(null);

  const schedule: Schedule = {
    frequency,
    dayOfMonth: frequency === "weekly" ? null : Number(day) || null,
    weekday: frequency === "weekly" ? weekday : null,
    monthOfYear: frequency === "yearly" ? Number(month) || null : null,
  };
  const scheduleOk =
    frequency === "weekly" || (Number(day) >= 1 && Number(day) <= 31 && (frequency === "monthly" || (Number(month) >= 1 && Number(month) <= 12)));
  const suggestedFirst = scheduleOk ? recurrenceOnOrAfter(schedule, todayISO()) : "";
  const scheduleChanged =
    !rule ||
    rule.frequency !== frequency ||
    rule.day_of_month !== schedule.dayOfMonth ||
    rule.weekday !== schedule.weekday ||
    rule.month_of_year !== schedule.monthOfYear;
  const [firstDate, setFirstDate] = useState(rule?.next_date ?? "");
  const nextDate = firstDate || (scheduleChanged ? suggestedFirst : (rule?.next_date ?? suggestedFirst));

  const balanceAccounts = accounts.filter((a) => isBalanceAccount(a) && !a.is_system && (!a.is_archived || a.id === fromId || a.id === toId));
  const categories = accounts.filter((a) => a.type === (kind === "income" ? "revenue" : "expense"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!name.trim()) return setError("請輸入名稱");
    if (!Number.isFinite(value) || value <= 0) return setError("請輸入大於 0 的金額");
    if (kind !== "income" && !fromId) return setError(kind === "transfer" ? "請選擇轉出帳戶" : "請選擇付款帳戶");
    if (kind !== "expense" && !toId) return setError(kind === "transfer" ? "請選擇轉入帳戶" : "請選擇存入帳戶");
    if (kind === "transfer" && fromId === toId) return setError("轉出與轉入帳戶不能相同");
    if (kind !== "transfer" && !categoryId) return setError("請選擇類別");
    if (!scheduleOk) return setError(frequency === "yearly" ? "請填 1–12 月與 1–31 日" : "每月第幾天請填 1–31");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return setError("請選擇日期");
    setError(null);
    try {
      await save.mutateAsync({
        id: rule?.id,
        ledger_id: ledgerId,
        name: name.trim(),
        kind,
        amount: value,
        amount_varies: varies,
        from_account_id: kind === "income" ? null : fromId,
        to_account_id: kind === "expense" ? null : toId,
        category_id: kind === "transfer" ? null : categoryId,
        memo: memo.trim() || null,
        frequency,
        day_of_month: schedule.dayOfMonth,
        weekday: schedule.weekday,
        month_of_year: schedule.monthOfYear,
        next_date: nextDate,
        is_active: rule?.is_active ?? true,
      });
      onClose();
    } catch (err) {
      setError(translateDbError(err));
    }
  };

  const radio = (active: boolean) =>
    cn("rounded-full px-3 py-1.5 text-sm font-bold transition-colors", active ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground");

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{rule ? "編輯固定支出" : "新增固定支出"}</DialogTitle>
        <DialogDescription>到期當天會出現在待確認匣與今天這一頁，點一下就入帳。</DialogDescription>
      </DialogHeader>
      <FormError message={error ?? undefined} />

      <Field label="名稱" htmlFor="rec-name">
        <Input id="rec-name" maxLength={30} placeholder="例如：房租、Netflix、電費" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>

      <div role="radiogroup" aria-label="種類" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1.5">
        {(
          [
            ["expense", "支出"],
            ["income", "收入"],
            ["transfer", "轉帳"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={kind === value} className={radio(kind === value)} onClick={() => setKind(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="金額" htmlFor="rec-amount">
          <Input id="rec-amount" inputMode="decimal" placeholder="12000" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <Checkbox checked={varies} onCheckedChange={(on) => setVaries(Boolean(on))} />
          每次金額不一樣（例如電費），確認時再改
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {kind !== "income" && (
          <Field label={kind === "transfer" ? "轉出帳戶" : "付款帳戶"} htmlFor="rec-from">
            <AccountSelect id="rec-from" accounts={balanceAccounts} value={fromId} onChange={setFromId} />
          </Field>
        )}
        {kind !== "expense" && (
          <Field label={kind === "transfer" ? "轉入帳戶" : "存入帳戶"} htmlFor="rec-to">
            <AccountSelect id="rec-to" accounts={balanceAccounts} value={toId} onChange={setToId} />
          </Field>
        )}
        {kind !== "transfer" && (
          <Field label="類別" htmlFor="rec-category">
            <CategorySelect id="rec-category" categories={categories} value={categoryId} onChange={setCategoryId} />
          </Field>
        )}
      </div>

      <div className="grid gap-3 rounded-xl bg-muted/50 p-3">
        <div role="radiogroup" aria-label="週期" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1.5">
          {(
            [
              ["monthly", "每月"],
              ["weekly", "每週"],
              ["yearly", "每年"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={frequency === value}
              className={radio(frequency === value)}
              onClick={() => {
                setFrequency(value);
                setFirstDate("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {frequency === "weekly" ? (
          <div role="radiogroup" aria-label="星期幾" className="flex flex-wrap gap-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={weekday === i}
                className={radio(weekday === i)}
                onClick={() => {
                  setWeekday(i);
                  setFirstDate("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {frequency === "yearly" && (
              <Field label="幾月" htmlFor="rec-month">
                <Input id="rec-month" type="number" min={1} max={12} value={month} onChange={(e) => {
                    setMonth(e.target.value);
                    setFirstDate("");
                  }} />
              </Field>
            )}
            <Field label={frequency === "yearly" ? "幾日" : "每月幾號"} htmlFor="rec-day" hint={frequency === "monthly" ? "填 31 代表月底" : undefined}>
              <Input id="rec-day" type="number" min={1} max={31} value={day} onChange={(e) => {
                  setDay(e.target.value);
                  setFirstDate("");
                }} />
            </Field>
          </div>
        )}
        <Field label={rule ? "下次日期" : "第一次日期"} htmlFor="rec-first" hint={scheduleOk ? `${describeSchedule(schedule)}；日期會自動對齊到週期上` : undefined}>
          <Input id="rec-first" type="date" value={nextDate} onChange={(e) => setFirstDate(e.target.value)} />
        </Field>
      </div>

      <Field label="備註（可留空，入帳時當交易備註）" htmlFor="rec-memo">
        <Input id="rec-memo" maxLength={100} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
          取消
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "儲存中…" : "儲存"}
        </Button>
      </DialogFooter>
    </form>
  );
}
