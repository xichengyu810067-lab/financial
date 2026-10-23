"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { ColorPicker } from "@/components/color-picker";
import { Field, FormError } from "@/components/form-field";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { translateDbError } from "@/lib/ledger/errors";
import { useSaveAccount } from "@/lib/ledger/queries";
import { SUBTYPES, type Account } from "@/lib/ledger/types";

const schema = z.object({
  name: z.string().trim().min(1, "請輸入名稱").max(30, "名稱最多 30 字"),
  type: z.enum(["asset", "liability"]),
  subtype: z.string().min(1, "請選擇子類型"),
  icon: z.string().min(1, "請選擇圖示"),
  color: z.string().min(1, "請選擇顏色"),
  opening: z
    .string()
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "請輸入 0 以上的數字"),
});

type FormValues = z.infer<typeof schema>;

const TYPE_ITEMS = [
  { value: "asset", label: "資產" },
  { value: "liability", label: "負債" },
];

const DEFAULT_BY_TYPE: Record<"asset" | "liability", { subtype: string; icon: string; color: string }> = {
  asset: { subtype: "cash", icon: "banknote", color: "emerald" },
  liability: { subtype: "credit_card", icon: "credit-card", color: "rose" },
};

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: string;
  account?: Account;
  defaultType: "asset" | "liability";
  /** 目前的期初餘額（編輯時用） */
  openingAmount: number;
  /** 已有交易紀錄時不允許改類型 */
  lockType: boolean;
}

export function AccountDialog({ open, onOpenChange, ledgerId, account, defaultType, openingAmount, lockType }: AccountDialogProps) {
  const save = useSaveAccount();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(account, defaultType, openingAmount),
  });

  useEffect(() => {
    if (open) form.reset(initialValues(account, defaultType, openingAmount));
  }, [open, account, defaultType, openingAmount, form]);

  const type = useWatch({ control: form.control, name: "type" });
  const subtypeItems = SUBTYPES.filter((s) => s.type === type).map((s) => ({ value: s.value, label: s.label }));

  const onSubmit = async (values: FormValues) => {
    const newOpening = values.opening === "" ? 0 : Number(values.opening);
    try {
      await save.mutateAsync({
        id: account?.id,
        ledgerId,
        name: values.name,
        type: values.type,
        subtype: values.subtype,
        icon: values.icon,
        color: values.color,
        openingAmount: newOpening !== openingAmount ? newOpening : undefined,
      });
      toast.success(account ? "已更新帳戶" : "已新增帳戶");
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: translateDbError(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "編輯帳戶" : "新增帳戶"}</DialogTitle>
          <DialogDescription>
            {account ? "修改名稱、圖示或期初餘額。" : "資產是你擁有的錢，負債是你欠的錢（例如信用卡）。"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormError message={form.formState.errors.root?.message} />

          <Field label="名稱" htmlFor="account-name" error={form.formState.errors.name?.message}>
            <Input id="account-name" maxLength={30} autoFocus {...form.register("name")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="類型" htmlFor="account-type" error={form.formState.errors.type?.message}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    items={TYPE_ITEMS}
                    disabled={lockType}
                    onValueChange={(value) => {
                      const next = value as "asset" | "liability";
                      field.onChange(next);
                      form.setValue("subtype", DEFAULT_BY_TYPE[next].subtype);
                      form.setValue("icon", DEFAULT_BY_TYPE[next].icon);
                      form.setValue("color", DEFAULT_BY_TYPE[next].color);
                    }}
                  >
                    <SelectTrigger id="account-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="子類型" htmlFor="account-subtype" error={form.formState.errors.subtype?.message}>
              <Controller
                control={form.control}
                name="subtype"
                render={({ field }) => (
                  <Select value={field.value} items={subtypeItems} onValueChange={(value) => field.onChange(value as string)}>
                    <SelectTrigger id="account-subtype" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subtypeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field label="圖示" htmlFor="account-icon" error={form.formState.errors.icon?.message}>
            <Controller
              control={form.control}
              name="icon"
              render={({ field }) => <IconPicker id="account-icon" value={field.value} onChange={field.onChange} />}
            />
          </Field>

          <Field label="顏色" error={form.formState.errors.color?.message}>
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
            />
          </Field>

          <Field
            label="期初餘額"
            htmlFor="account-opening"
            error={form.formState.errors.opening?.message}
            hint={type === "liability" ? "填目前欠的金額（正數）" : "開始記帳那天這個帳戶裡的金額，可留空"}
          >
            <Input
              id="account-opening"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
              {...form.register("opening")}
            />
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

function initialValues(account: Account | undefined, defaultType: "asset" | "liability", openingAmount: number): FormValues {
  if (account) {
    const type = account.type === "liability" ? "liability" : "asset";
    return {
      name: account.name,
      type,
      subtype: account.subtype ?? DEFAULT_BY_TYPE[type].subtype,
      icon: account.icon ?? DEFAULT_BY_TYPE[type].icon,
      color: account.color ?? DEFAULT_BY_TYPE[type].color,
      opening: openingAmount > 0 ? String(openingAmount) : "",
    };
  }
  return { name: "", type: defaultType, ...DEFAULT_BY_TYPE[defaultType], opening: "" };
}
