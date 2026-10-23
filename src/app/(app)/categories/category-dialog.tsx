"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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
import type { Account } from "@/lib/ledger/types";

const NONE = "__none__";

const schema = z.object({
  name: z.string().trim().min(1, "請輸入名稱").max(30, "名稱最多 30 字"),
  parentId: z.string(),
  icon: z.string().min(1, "請選擇圖示"),
  color: z.string().min(1, "請選擇顏色"),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_BY_TYPE: Record<"revenue" | "expense", { icon: string; color: string }> = {
  revenue: { icon: "hand-coins", color: "emerald" },
  expense: { icon: "tag", color: "slate" },
};

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: string;
  type: "revenue" | "expense";
  category?: Account;
  defaultParentId: string | null;
  parentOptions: Account[];
  hasChildren: boolean;
}

export function CategoryDialog({
  open,
  onOpenChange,
  ledgerId,
  type,
  category,
  defaultParentId,
  parentOptions,
  hasChildren,
}: CategoryDialogProps) {
  const save = useSaveAccount();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(category, type, defaultParentId),
  });

  useEffect(() => {
    if (open) form.reset(initialValues(category, type, defaultParentId));
  }, [open, category, type, defaultParentId, form]);

  const parentItems = [{ value: NONE, label: "無（第一層類別）" }, ...parentOptions.map((p) => ({ value: p.id, label: p.name }))];

  const onSubmit = async (values: FormValues) => {
    try {
      await save.mutateAsync({
        id: category?.id,
        ledgerId,
        name: values.name,
        type,
        icon: values.icon,
        color: values.color,
        parentId: values.parentId === NONE ? null : values.parentId,
      });
      toast.success(category ? "已更新類別" : "已新增類別");
      onOpenChange(false);
    } catch (err) {
      form.setError("root", { message: translateDbError(err) });
    }
  };

  const typeLabel = type === "expense" ? "費用" : "收入";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? `編輯${typeLabel}類別` : `新增${typeLabel}類別`}</DialogTitle>
          <DialogDescription>
            {hasChildren ? "這個類別底下有子類別，因此只能當第一層。" : "可以選擇放在某個第一層類別底下，成為子類別。"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormError message={form.formState.errors.root?.message} />

          <Field label="名稱" htmlFor="category-name" error={form.formState.errors.name?.message}>
            <Input id="category-name" maxLength={30} autoFocus {...form.register("name")} />
          </Field>

          <Field label="上層類別" htmlFor="category-parent" error={form.formState.errors.parentId?.message}>
            <Controller
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  items={parentItems}
                  disabled={hasChildren}
                  onValueChange={(value) => field.onChange(value as string)}
                >
                  <SelectTrigger id="category-parent" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parentItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="圖示" htmlFor="category-icon" error={form.formState.errors.icon?.message}>
            <Controller
              control={form.control}
              name="icon"
              render={({ field }) => <IconPicker id="category-icon" value={field.value} onChange={field.onChange} />}
            />
          </Field>

          <Field label="顏色" error={form.formState.errors.color?.message}>
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
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

function initialValues(category: Account | undefined, type: "revenue" | "expense", defaultParentId: string | null): FormValues {
  if (category) {
    return {
      name: category.name,
      parentId: category.parent_id ?? NONE,
      icon: category.icon ?? DEFAULT_BY_TYPE[type].icon,
      color: category.color ?? DEFAULT_BY_TYPE[type].color,
    };
  }
  return { name: "", parentId: defaultParentId ?? NONE, ...DEFAULT_BY_TYPE[type] };
}
