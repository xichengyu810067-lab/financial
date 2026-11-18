"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "cn";
import { AccountSelect } from "@/components/entry/account-select";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { translateDbError } from "@/lib/ledger/errors";
import type { GoalStatus } from "@/lib/ledger/goal-model";
import { useSaveGoal } from "@/lib/ledger/goals";
import type { Account } from "@/lib/ledger/types";

const schema = z
  .object({
    name: z.string().trim().min(1, "請輸入目標名稱").max(30, "名稱最多 30 字"),
    target: z.string().refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "請輸入大於 0 的金額"),
    targetDate: z.string(),
    mode: z.enum(["account", "manual"]),
    accountId: z.string(),
    note: z.string().max(100, "備註最多 100 字"),
  })
  .refine((v) => v.mode === "manual" || v.accountId !== "", { path: ["accountId"], message: "請選擇要綁定的帳戶" });

type FormValues = z.infer<typeof schema>;

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: string;
  /** 可以綁定的帳戶（資產帳戶） */
  accounts: Account[];
  /** 編輯時傳入；新增時不給 */
  status?: GoalStatus;
  /** 新增時的排序 */
  nextSortOrder: number;
}

function initialValues(status: GoalStatus | undefined): FormValues {
  const goal = status?.goal;
  return {
    name: goal?.name ?? "",
    target: goal ? String(goal.target_amount) : "",
    targetDate: goal?.target_date ?? "",
    mode: goal?.account_id ? "account" : goal ? "manual" : "account",
    accountId: goal?.account_id ?? "",
    note: goal?.note ?? "",
  };
}

/** 新增／編輯儲蓄目標：名稱、金額、目標日（可空）、綁帳戶或手動存入、備註 */
export function GoalDialog({ open, onOpenChange, ledgerId, accounts, status, nextSortOrder }: GoalDialogProps) {
  const save = useSaveGoal();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initialValues(status) });

  useEffect(() => {
    if (open) form.reset(initialValues(status));
  }, [open, status, form]);

  const mode = useWatch({ control: form.control, name: "mode" });
  // 手動目標已經有存入就不能改成綁帳戶，不然存入紀錄會被晾在一邊
  const lockManual = Boolean(status && !status.goal.account_id && status.saved > 0);
  const selectable = accounts.filter((a) => !a.is_archived || a.id === status?.goal.account_id);

  const onSubmit = async (values: FormValues) => {
    const targetAmount = Number(values.target);
    try {
      await save.mutateAsync({
        id: status?.goal.id,
        ledgerId,
        name: values.name,
        targetAmount,
        targetDate: values.targetDate || null,
        accountId: values.mode === "account" ? values.accountId : null,
        note: values.note,
        sortOrder: nextSortOrder,
        resetAchieved: Boolean(status && targetAmount > status.target),
      });
      toast.success(status ? "已更新目標" : "已新增目標");
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: translateDbError(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{status ? "編輯目標" : "設一個儲蓄目標"}</DialogTitle>
          <DialogDescription>綁一個帳戶就看它的餘額；選手動的話，每存一筆就按「存入」。</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormError message={form.formState.errors.root?.message} />

          <Field label="目標名稱" htmlFor="goal-name" error={form.formState.errors.name?.message}>
            <Input id="goal-name" maxLength={30} placeholder="例如：日本旅行" autoFocus {...form.register("name")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="目標金額" htmlFor="goal-target" error={form.formState.errors.target?.message}>
              <Input id="goal-target" type="number" inputMode="decimal" min={0} step="1" placeholder="50000" {...form.register("target")} />
            </Field>
            <Field label="目標日（可留空）" htmlFor="goal-date" error={form.formState.errors.targetDate?.message}>
              <Input id="goal-date" type="date" {...form.register("targetDate")} />
            </Field>
          </div>

          <Field label="進度怎麼算" error={form.formState.errors.mode?.message}>
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <div role="radiogroup" aria-label="進度怎麼算" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1.5">
                  {(
                    [
                      { value: "account", label: "綁一個帳戶", disabled: lockManual },
                      { value: "manual", label: "手動存入", disabled: false },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === option.value}
                      disabled={option.disabled}
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-40",
                        field.value === option.value ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>

          {mode === "account" ? (
            <Field
              label="綁定的帳戶"
              htmlFor="goal-account"
              error={form.formState.errors.accountId?.message}
              hint="進度 = 這個帳戶目前的餘額，轉帳進去就會上升"
            >
              <Controller
                control={form.control}
                name="accountId"
                render={({ field }) => <AccountSelect id="goal-account" accounts={selectable} value={field.value} onChange={field.onChange} />}
              />
            </Field>
          ) : (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {lockManual ? "這個目標已經有存入紀錄，維持手動存入。" : "進度 = 你按「存入」記下的金額合計。"}
            </p>
          )}

          <Field label="備註（可留空）" htmlFor="goal-note" error={form.formState.errors.note?.message}>
            <Input id="goal-note" maxLength={100} {...form.register("note")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              取消
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
