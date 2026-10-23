"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Plus, SquareCheck, Trash, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useEntrySheet } from "@/components/entry/entry-sheet-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { currentMonth, isValidMonth, monthLabel, useDeleteEntries, useEntries, type Entry } from "@/lib/ledger/entries";
import { translateDbError } from "@/lib/ledger/errors";
import { useAccounts, useLedger } from "@/lib/ledger/queries";
import { isBalanceAccount, isCategory } from "@/lib/ledger/types";
import { DEFAULT_FILTERS, EntryFiltersBar, type EntryFilters } from "./entry-filters";
import { EntryList, groupByDay } from "./entry-list";
import { MonthSummary } from "./month-summary";
import { MonthSwitcher } from "./month-switcher";

export function TransactionsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");
  const month = isValidMonth(monthParam) ? monthParam : currentMonth();

  const { data: ledger } = useLedger();
  const ledgerId = ledger?.id;
  const { data: accounts } = useAccounts(ledgerId);
  const { data: entries, isPending } = useEntries(ledgerId, month);
  const { openNew, openEdit, openCopy } = useEntrySheet();
  const remove = useDeleteEntries();

  const [filters, setFilters] = useState<EntryFilters>(DEFAULT_FILTERS);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [confirmBatch, setConfirmBatch] = useState(false);

  const setMonth = (m: string) => router.replace(`/transactions?month=${m}`);

  if (!ledgerId || !accounts || isPending || !entries) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const balanceAccounts = accounts.filter((a) => isBalanceAccount(a) && !a.is_system);
  const categories = accounts.filter((a) => isCategory(a) && !a.is_archived);

  // 摘要固定看整月，不受篩選影響
  const income = entries.filter((e) => e.kind === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expense = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);

  const categoryIds =
    filters.categoryId === "all"
      ? null
      : new Set([filters.categoryId, ...accounts.filter((a) => a.parent_id === filters.categoryId).map((a) => a.id)]);
  const keyword = filters.keyword.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (filters.kind !== "all" && e.kind !== filters.kind) return false;
    if (filters.accountId !== "all" && e.from_account_id !== filters.accountId && e.to_account_id !== filters.accountId) return false;
    if (categoryIds && (!e.category_id || !categoryIds.has(e.category_id))) return false;
    if (keyword && !(e.memo ?? "").toLowerCase().includes(keyword)) return false;
    return true;
  });
  const groups = groupByDay(filtered);
  const isFiltering = filters.kind !== "all" || filters.accountId !== "all" || filters.categoryId !== "all" || keyword !== "";

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const fail = (err: unknown) => toast.error(translateDbError(err));

  const deleteOne = () => {
    if (!deleting) return;
    remove.mutate(
      { ledgerId, ids: [deleting.id] },
      {
        onSuccess: () => {
          toast.success("已刪除交易");
          setDeleting(null);
        },
        onError: fail,
      },
    );
  };

  const deleteSelected = () => {
    remove.mutate(
      { ledgerId, ids: Array.from(selected) },
      {
        onSuccess: () => {
          toast.success(`已刪除 ${selected.size} 筆交易`);
          setConfirmBatch(false);
          exitSelectMode();
        },
        onError: fail,
      },
    );
  };

  return (
    <>
      <PageHeader
        title="交易"
        description={`${monthLabel(month)}，共 ${entries.length} 筆`}
        actions={
          selectMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set(filtered.map((e) => e.id)))}>
                全選
              </Button>
              <Button variant="destructive" size="sm" disabled={selected.size === 0} onClick={() => setConfirmBatch(true)}>
                <Trash className="size-4" aria-hidden />
                刪除選取（{selected.size}）
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                <X className="size-4" aria-hidden />
                取消
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectMode(true)} disabled={entries.length === 0}>
                <SquareCheck className="size-4" aria-hidden />
                選取
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="size-4" aria-hidden />
                記一筆
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-4">
        <MonthSwitcher month={month} onChange={setMonth} />
        <MonthSummary income={income} expense={expense} />
        <EntryFiltersBar filters={filters} onChange={setFilters} accounts={balanceAccounts} categories={categories} />

        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{monthLabel(month)}還沒有交易。</p>
            <Button className="mt-4" onClick={openNew}>
              <Plus className="size-4" aria-hidden />
              記一筆
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            沒有符合篩選條件的交易。
          </p>
        ) : (
          <>
            {isFiltering && (
              <p className="text-xs text-muted-foreground">
                顯示 {filtered.length} / {entries.length} 筆
                <button type="button" className="ml-2 underline underline-offset-4" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  清除篩選
                </button>
              </p>
            )}
            <EntryList
              groups={groups}
              accountsById={accountsById}
              selectMode={selectMode}
              selected={selected}
              onToggle={toggle}
              onEdit={openEdit}
              onCopy={openCopy}
              onDelete={setDeleting}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="刪除這筆交易？"
        description="刪除後帳戶餘額會立即還原，無法復原。"
        confirmLabel="刪除"
        destructive
        pending={remove.isPending}
        onConfirm={deleteOne}
      />
      <ConfirmDialog
        open={confirmBatch}
        onOpenChange={setConfirmBatch}
        title={`刪除選取的 ${selected.size} 筆交易？`}
        description="刪除後帳戶餘額會立即還原，無法復原。"
        confirmLabel="全部刪除"
        destructive
        pending={remove.isPending}
        onConfirm={deleteSelected}
      />
    </>
  );
}
