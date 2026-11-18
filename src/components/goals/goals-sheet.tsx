"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, Pencil, PiggyBank, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { translateDbError } from "@/lib/ledger/errors";
import { sortGoalStatuses, type GoalStatus } from "@/lib/ledger/goal-model";
import { useArchiveGoal } from "@/lib/ledger/goals";
import { GoalProgress } from "./goal-progress";

interface GoalsSheetProps {
  open: boolean;
  onClose: () => void;
  /** 有對話框疊在上面時，點對話框或按 Esc 不要連面板一起關 */
  childOpen: boolean;
  ledgerId: string;
  statuses: GoalStatus[];
  accountNameOf: (id: string | null) => string | null;
  onCreate: () => void;
  onEdit: (status: GoalStatus) => void;
  onDeposit: (status: GoalStatus) => void;
}

/** 全部目標：未封存的照順序列出（已達標放最後），可新增、編輯、存入、封存；封存的收在最下面 */
export function GoalsSheet({ open, onClose, childOpen, ledgerId, statuses, accountNameOf, onCreate, onEdit, onDeposit }: GoalsSheetProps) {
  const archive = useArchiveGoal();
  const [showArchived, setShowArchived] = useState(false);
  const active = sortGoalStatuses(statuses.filter((s) => !s.goal.is_archived));
  const archived = sortGoalStatuses(statuses.filter((s) => s.goal.is_archived));

  const setArchived = async (status: GoalStatus, value: boolean) => {
    try {
      await archive.mutateAsync({ ledgerId, goalId: status.goal.id, archived: value });
      toast.success(value ? `已封存「${status.goal.name}」` : `已取消封存「${status.goal.name}」`);
    } catch (err) {
      toast.error(translateDbError(err));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next, details) => {
        if (next) return;
        if (childOpen && (details.reason === "outside-press" || details.reason === "escape-key" || details.reason === "focus-out")) {
          details.cancel();
          return;
        }
        onClose();
      }}
    >
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="font-hand text-[24px] font-bold">全部目標</SheetTitle>
          <SheetDescription>預測照最近三個月的存入速度算。</SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 content-start gap-3 px-6 pt-3 pb-6">
          <Button variant="outline" onClick={onCreate} className="justify-self-start">
            <Plus className="size-4" aria-hidden />
            新增目標
          </Button>

          {active.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center font-hand text-[15px] text-muted-foreground">
              還沒有目標。存錢有個名字，比較存得下去。
            </p>
          ) : (
            <ul className="grid gap-3">
              {active.map((status) => (
                <li key={status.goal.id} className="rounded-[14px] bg-card px-4 py-3 ring-1 ring-border">
                  <GoalProgress status={status} accountName={accountNameOf(status.goal.account_id)} />
                  {status.goal.note && <p className="mt-1 text-xs text-muted-foreground">{status.goal.note}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!status.goal.account_id && !status.achieved && (
                      <Button size="sm" onClick={() => onDeposit(status)}>
                        <PiggyBank className="size-4" aria-hidden />
                        存入
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onEdit(status)}>
                      <Pencil className="size-4" aria-hidden />
                      編輯
                    </Button>
                    <Button size="sm" variant="ghost" disabled={archive.isPending} onClick={() => void setArchived(status, true)}>
                      <Archive className="size-4" aria-hidden />
                      封存
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {archived.length > 0 && (
            <section className="mt-2 grid gap-2">
              <button
                type="button"
                aria-expanded={showArchived}
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-1 text-left text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("size-4 transition-transform", !showArchived && "-rotate-90")} aria-hidden />
                已封存 {archived.length} 個
              </button>
              {showArchived && (
                <ul className="grid gap-2">
                  {archived.map((status) => (
                    <li key={status.goal.id} className="flex items-center justify-between gap-2 rounded-[12px] border border-dashed border-line px-3 py-2">
                      <span className="truncate text-sm">
                        {status.goal.name}
                        <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{status.percent}%</span>
                      </span>
                      <Button size="sm" variant="ghost" disabled={archive.isPending} onClick={() => void setArchived(status, false)}>
                        <ArchiveRestore className="size-4" aria-hidden />
                        取消封存
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        <span aria-hidden className="receipt-edge shrink-0" />
      </SheetContent>
    </Sheet>
  );
}
