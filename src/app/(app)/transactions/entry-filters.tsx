"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account } from "@/lib/ledger/types";

export interface EntryFilters {
  kind: "all" | "expense" | "income" | "transfer";
  accountId: string; // "all" 或帳戶 id
  categoryId: string; // "all" 或類別 id
  keyword: string;
}

export const DEFAULT_FILTERS: EntryFilters = { kind: "all", accountId: "all", categoryId: "all", keyword: "" };

interface EntryFiltersBarProps {
  filters: EntryFilters;
  onChange: (filters: EntryFilters) => void;
  accounts: Account[];
  categories: Account[];
}

const KIND_ITEMS = [
  { value: "all", label: "全部種類" },
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "轉帳" },
];

export function EntryFiltersBar({ filters, onChange, accounts, categories }: EntryFiltersBarProps) {
  const accountItems = [{ value: "all", label: "全部帳戶" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const categoryItems = [
    { value: "all", label: "全部類別" },
    ...categories
      .slice()
      .sort((a, b) => a.type.localeCompare(b.type) || a.sort_order - b.sort_order)
      .map((c) => ({
        value: c.id,
        label: c.parent_id ? `${byId.get(c.parent_id)?.name ?? ""} › ${c.name}` : c.name,
      })),
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_1fr]">
      <Select value={filters.kind} items={KIND_ITEMS} onValueChange={(v) => onChange({ ...filters, kind: v as EntryFilters["kind"] })}>
        <SelectTrigger aria-label="種類" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KIND_ITEMS.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.accountId} items={accountItems} onValueChange={(v) => onChange({ ...filters, accountId: v as string })}>
        <SelectTrigger aria-label="帳戶" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {accountItems.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.categoryId} items={categoryItems} onValueChange={(v) => onChange({ ...filters, categoryId: v as string })}>
        <SelectTrigger aria-label="類別" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categoryItems.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={filters.keyword}
          onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          placeholder="搜尋備註"
          aria-label="搜尋備註"
          className="pl-8"
        />
      </div>
    </div>
  );
}
