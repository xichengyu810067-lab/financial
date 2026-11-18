"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Field, FormError } from "@/components/form-field";
import { useFeedback } from "@/components/journal/animations/feedback-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD, todayISO } from "@/lib/ledger/format";
import { goalReachedByDeposit, type GoalStatus } from "@/lib/ledger/goal-model";
import { useAddDeposit } from "@/lib/ledger/goals";

const schema = z.object({
  amount: z.string().refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "請輸入大於 0 的金額"),
  date: z
    .string()
    .min(1, "請選擇日期")
    .refine((v) => v <= todayISO(), "不能存到未來的日子"),
  note: z.string().max(100, "備註最多 100 字"),
});

type FormValues = z.infer<typeof schema>;

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: string;
  /** 只給手動目標 */
  status: GoalStatus | null;
}

/** 手動目標的存入：金額、日期、備註。存完播撲滿；第一次存滿就播加強版。 */
export function DepositDialog({ open, onOpenChange, ledgerId, status }: DepositDialogProps) {
  const add = useAddDeposit();
  const feedback = useFeedback();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { amount: "", date: todayISO(), note: "" } });

  useEffect(() => {
    if (open) form.reset({ amount: "", date: todayISO(), note: "" });
  }, [open, form]);

  if (!status) return null;

  const onSubmit = async (values: FormValues) => {
    const amount = Number(values.amount);
    try {
      await add.mutateAsync({ ledgerId, goalId: status.goal.id, amount, date: values.date, note: values.note });
      const reached = goalReachedByDeposit(status, amount, values.date, todayISO());
      toast.success(`已存入 ${formatTWD(amount)}`);
      feedback.play({ kind: reached ? "achieved" : "saving", amount, label: status.goal.name });
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: translateDbError(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>存入「{status.goal.name}」</DialogTitle>
          <DialogDescription>
            已存 {formatTWD(status.saved)}，還差 {formatTWD(status.remaining)}。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormError message={form.formState.errors.root?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="金額" htmlFor="deposit-amount" error={form.formState.errors.amount?.message}>
              <Input id="deposit-amount" type="number" inputMode="decimal" min={0} step="1" autoFocus {...form.register("amount")} />
            </Field>
            <Field label="日期" htmlFor="deposit-date" error={form.formState.errors.date?.message}>
              <Input id="deposit-date" type="date" max={todayISO()} {...form.register("date")} />
            </Field>
          </div>
          <Field label="備註（可留空）" htmlFor="deposit-note" error={form.formState.errors.note?.message}>
            <Input id="deposit-note" maxLength={100} {...form.register("note")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
              取消
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "存入中…" : "存入"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
