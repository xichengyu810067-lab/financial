"use client";

import { AccountIcon } from "@/components/account-icon";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account } from "@/lib/ledger/types";

interface CategorySelectProps {
  id?: string;
  /** 該類型（收入或費用）的全部類別，含已封存；元件自行處理顯示規則 */
  categories: Account[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

/** 兩層類別選單：父類別本身可選，子類別縮排顯示在父類別底下 */
export function CategorySelect({ id, categories, value, onChange, placeholder = "選擇類別" }: CategorySelectProps) {
  const visible = (c: Account) => !c.is_archived || c.id === value;
  const parents = categories.filter((c) => c.parent_id === null && visible(c));
  // 父類別已封存但子類別被選中的罕見情況：把父類別補回來以便顯示
  for (const c of categories) {
    if (c.parent_id && c.id === value && !parents.some((p) => p.id === c.parent_id)) {
      const parent = categories.find((p) => p.id === c.parent_id);
      if (parent) parents.push(parent);
    }
  }
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId && visible(c));

  const items = parents.flatMap((p) => [
    { value: p.id, label: p.name },
    ...childrenOf(p.id).map((c) => ({ value: c.id, label: `${p.name} › ${c.name}` })),
  ]);

  return (
    <Select value={value || null} items={items} onValueChange={(v) => onChange((v as string | null) ?? "")}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {parents.map((parent) => {
          const children = childrenOf(parent.id);
          return (
            <SelectGroup key={parent.id}>
              <SelectItem value={parent.id}>
                <span className="flex items-center gap-2 font-medium">
                  <AccountIcon icon={parent.icon} color={parent.color} size="sm" />
                  {parent.name}
                  {parent.is_archived && <span className="text-xs text-muted-foreground">（已封存）</span>}
                </span>
              </SelectItem>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  <span className="flex items-center gap-2 pl-5">
                    <AccountIcon icon={child.icon} color={child.color} size="sm" />
                    {child.name}
                    {child.is_archived && <span className="text-xs text-muted-foreground">（已封存）</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
