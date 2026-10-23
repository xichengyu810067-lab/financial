"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, EllipsisVertical, Pencil, Plus, Trash } from "lucide-react";
import { toast } from "sonner";
import { AccountIcon } from "@/components/account-icon";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD } from "@/lib/ledger/format";
import {
  useAccounts,
  useBalances,
  useDeleteAccount,
  useLedger,
  useMoveAccount,
  useOpeningBalances,
  useSetArchived,
} from "@/lib/ledger/queries";
import { isBalanceAccount, subtypeLabel, type Account } from "@/lib/ledger/types";
import { AccountDialog } from "./account-dialog";

type DialogState = { open: false } | { open: true; account?: Account; type: "asset" | "liability" };

export function AccountsView() {
  const { data: ledger } = useLedger();
  const ledgerId = ledger?.id;
  const { data: accounts, isPending } = useAccounts(ledgerId);
  const { data: balances } = useBalances(ledgerId);
  const { data: openings } = useOpeningBalances(ledgerId);
  const move = useMoveAccount();
  const setArchived = useSetArchived();
  const remove = useDeleteAccount();

  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (!ledger || !ledgerId || isPending || !accounts) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const balanceOf = (id: string) => Number(balances?.get(id)?.balance ?? 0);
  const linesOf = (id: string) => balances?.get(id)?.line_count ?? 0;

  const all = accounts.filter((a) => isBalanceAccount(a) && !a.is_system);
  const active = all.filter((a) => !a.is_archived);
  const archived = all.filter((a) => a.is_archived);
  const assets = active.filter((a) => a.type === "asset");
  const liabilities = active.filter((a) => a.type === "liability");
  const totalAssets = assets.reduce((s, a) => s + balanceOf(a.id), 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + balanceOf(a.id), 0);

  const fail = (err: unknown) => toast.error(translateDbError(err));

  const handleMove = (account: Account, direction: "up" | "down") =>
    move.mutate({ ledgerId, id: account.id, direction }, { onError: fail });

  const handleArchive = (account: Account, archivedFlag: boolean) =>
    setArchived.mutate(
      { ledgerId, ids: [account.id], archived: archivedFlag },
      { onSuccess: () => toast.success(archivedFlag ? "已封存" : "已取消封存"), onError: fail },
    );

  const handleDelete = (account: Account) => {
    if (linesOf(account.id) > 0) {
      toast.error("有交易紀錄的帳戶只能封存，不能刪除");
      return;
    }
    setDeleting(account);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(
      { ledgerId, id: deleting.id },
      {
        onSuccess: () => {
          toast.success("已刪除");
          setDeleting(null);
        },
        onError: fail,
      },
    );
  };

  const renderRows = (list: Account[]) =>
    list.map((account, index) => (
      <AccountRow
        key={account.id}
        account={account}
        balance={balanceOf(account.id)}
        isFirst={index === 0}
        isLast={index === list.length - 1}
        onMove={(dir) => handleMove(account, dir)}
        onEdit={() => setDialog({ open: true, account, type: account.type as "asset" | "liability" })}
        onArchive={() => handleArchive(account, true)}
        onDelete={() => handleDelete(account)}
      />
    ));

  return (
    <>
      <PageHeader
        title="帳戶"
        description={`期初餘額以帳本起始日 ${ledger.start_date} 為基準，可在設定頁修改。`}
        actions={
          <Button onClick={() => setDialog({ open: true, type: "asset" })}>
            <Plus className="size-4" aria-hidden />
            新增帳戶
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="資產合計" value={totalAssets} />
        <SummaryCard label="負債合計" value={totalLiabilities} />
        <SummaryCard label="淨值" value={totalAssets - totalLiabilities} emphasis />
      </div>

      <div className="grid gap-6">
        <Section title="資產" description="現金、銀行、電子支付、投資等" count={assets.length}>
          {assets.length === 0 ? <EmptyHint text="還沒有資產帳戶" /> : renderRows(assets)}
        </Section>
        <Section title="負債" description="信用卡、貸款等" count={liabilities.length}>
          {liabilities.length === 0 ? <EmptyHint text="還沒有負債帳戶" /> : renderRows(liabilities)}
        </Section>

        {archived.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>已封存</CardTitle>
                <CardDescription>封存的帳戶不會出現在記帳選單，但歷史交易仍保留。</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "收起" : `顯示 ${archived.length} 個`}
              </Button>
            </CardHeader>
            {showArchived && (
              <CardContent className="grid gap-2">
                {archived.map((account) => (
                  <div key={account.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 opacity-80">
                    <AccountIcon icon={account.icon} color={account.color} size="sm" />
                    <span className="flex-1 truncate text-sm">{account.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">{formatTWD(balanceOf(account.id))}</span>
                    <Button variant="outline" size="sm" onClick={() => handleArchive(account, false)}>
                      <ArchiveRestore className="size-4" aria-hidden />
                      取消封存
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {dialog.open && (
        <AccountDialog
          open
          onOpenChange={(open) => !open && setDialog({ open: false })}
          ledgerId={ledgerId}
          account={dialog.account}
          defaultType={dialog.type}
          openingAmount={dialog.account ? (openings?.get(dialog.account.id) ?? 0) : 0}
          lockType={dialog.account ? linesOf(dialog.account.id) > 0 : false}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`刪除「${deleting?.name ?? ""}」？`}
        description="這個帳戶沒有任何交易紀錄，刪除後無法復原。"
        confirmLabel="刪除"
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function SummaryCard({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <Card className="py-4">
      <CardContent className="grid gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={emphasis ? "text-2xl font-semibold tabular-nums" : "text-xl font-medium tabular-nums"}>
          {formatTWD(value)}
        </span>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary">{count}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">{children}</CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

interface AccountRowProps {
  account: Account;
  balance: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function AccountRow({ account, balance, isFirst, isLast, onMove, onEdit, onArchive, onDelete }: AccountRowProps) {
  const subtype = subtypeLabel(account.subtype);
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <AccountIcon icon={account.icon} color={account.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{account.name}</span>
          {subtype && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {subtype}
            </Badge>
          )}
        </div>
      </div>
      <span className="text-sm font-medium tabular-nums">{formatTWD(balance)}</span>
      <div className="hidden items-center sm:flex">
        <Button variant="ghost" size="icon-sm" aria-label="上移" disabled={isFirst} onClick={() => onMove("up")}>
          <ArrowUp className="size-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="下移" disabled={isLast} onClick={() => onMove("down")}>
          <ArrowDown className="size-4" aria-hidden />
        </Button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="更多操作" />}>
          <EllipsisVertical className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
            編輯
          </DropdownMenuItem>
          <DropdownMenuItem className="sm:hidden" disabled={isFirst} onClick={() => onMove("up")}>
            <ArrowUp className="size-4" aria-hidden />
            上移
          </DropdownMenuItem>
          <DropdownMenuItem className="sm:hidden" disabled={isLast} onClick={() => onMove("down")}>
            <ArrowDown className="size-4" aria-hidden />
            下移
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="size-4" aria-hidden />
            封存
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash className="size-4" aria-hidden />
            刪除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
