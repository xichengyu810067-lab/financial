"use client";

import { useState } from "react";
import { PiggyBank, Target } from "lucide-react";
import { DepositDialog } from "@/components/goals/deposit-dialog";
import { GoalDialog } from "@/components/goals/goal-dialog";
import { GoalProgress } from "@/components/goals/goal-progress";
import { GoalsSheet } from "@/components/goals/goals-sheet";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { pickFeaturedGoal, type GoalStatus } from "@/lib/ledger/goal-model";
import { useGoalStatuses } from "@/lib/ledger/goals";
import type { Account } from "@/lib/ledger/types";

interface GoalCardProps {
  ledgerId: string;
  accounts: Account[];
  today: string;
}

type DialogState = { kind: "goal"; status?: GoalStatus } | { kind: "deposit"; status: GoalStatus } | null;

/**
 * 今天這一頁的目標卡：只顯示最接近達標的一個（規則在 pickFeaturedGoal），
 * 「全部目標」開右側面板管理；新增／編輯／存入的對話框都由這裡開。
 */
export function GoalCard({ ledgerId, accounts, today }: GoalCardProps) {
  const goalsQuery = useGoalStatuses(ledgerId, today);
  const { statuses, error } = goalsQuery;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  // 關閉時保留最後一個目標，讓對話框淡出時內容不會突然清空
  const [lastDeposit, setLastDeposit] = useState<GoalStatus | null>(null);

  if (error) {
    return <LoadError title="目標載入失敗" error={error} retrying={goalsQuery.isFetching} onRetry={() => void goalsQuery.refetch()} />;
  }
  if (!statuses) return <Skeleton className="h-36 w-full rounded-[18px]" />;

  const savingAccounts = accounts.filter((a) => a.type === "asset" && !a.is_system);
  const accountNameOf = (id: string | null) => (id ? (accounts.find((a) => a.id === id)?.name ?? "已刪除的帳戶") : null);
  const featured = pickFeaturedGoal(statuses, today);
  const nextSortOrder = statuses.reduce((max, s) => Math.max(max, s.goal.sort_order), 0) + 1;

  const openDeposit = (status: GoalStatus) => {
    setLastDeposit(status);
    setDialog({ kind: "deposit", status });
  };

  return (
    <>
      <Card size="sm" className="border-t-[3px] border-t-income">
        <CardContent className="grid gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="size-3.5" aria-hidden />
              儲蓄目標
            </span>
            {statuses.length > 0 && (
              <button type="button" onClick={() => setSheetOpen(true)} className="text-[11px] text-muted-foreground underline-offset-4 hover:underline">
                全部目標 →
              </button>
            )}
          </div>

          {featured ? (
            <>
              <GoalProgress status={featured} accountName={accountNameOf(featured.goal.account_id)} />
              {!featured.goal.account_id && !featured.achieved && (
                <Button size="sm" className="justify-self-start" onClick={() => openDeposit(featured)}>
                  <PiggyBank className="size-4" aria-hidden />
                  存入
                </Button>
              )}
            </>
          ) : (
            <div className="grid gap-2">
              <p className="font-hand text-[16px]">{statuses.length > 0 ? "目標都封存了。" : "還沒有儲蓄目標。"}</p>
              <p className="text-xs text-muted-foreground">替想存的錢取個名字，例如「日本旅行 5 萬」，這裡就會顯示進度與預計哪個月達標。</p>
              <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setDialog({ kind: "goal" })}>
                設一個儲蓄目標
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <GoalsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        childOpen={dialog !== null}
        ledgerId={ledgerId}
        statuses={statuses}
        accountNameOf={accountNameOf}
        onCreate={() => setDialog({ kind: "goal" })}
        onEdit={(status) => setDialog({ kind: "goal", status })}
        onDeposit={openDeposit}
      />
      <GoalDialog
        open={dialog?.kind === "goal"}
        onOpenChange={(open) => !open && setDialog(null)}
        ledgerId={ledgerId}
        accounts={savingAccounts}
        status={dialog?.kind === "goal" ? dialog.status : undefined}
        nextSortOrder={nextSortOrder}
      />
      <DepositDialog
        open={dialog?.kind === "deposit"}
        onOpenChange={(open) => !open && setDialog(null)}
        ledgerId={ledgerId}
        status={dialog?.kind === "deposit" ? dialog.status : lastDeposit}
      />
    </>
  );
}
