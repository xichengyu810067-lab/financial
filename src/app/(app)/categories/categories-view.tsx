"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  EllipsisVertical,
  FolderPlus,
  Pencil,
  Plus,
  Trash,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD } from "@/lib/ledger/format";
import { useAccounts, useBalances, useDeleteAccount, useLedger, useMoveAccount, useSetArchived } from "@/lib/ledger/queries";
import { isCategory, type Account } from "@/lib/ledger/types";
import { CategoryDialog } from "./category-dialog";

type CategoryType = "revenue" | "expense";

type DialogState =
  | { open: false }
  | { open: true; type: CategoryType; category?: Account; parentId: string | null };

export function CategoriesView() {
  const { data: ledger } = useLedger();
  const ledgerId = ledger?.id;
  const { data: accounts, isPending } = useAccounts(ledgerId);
  const { data: balances } = useBalances(ledgerId);
  const move = useMoveAccount();
  const setArchived = useSetArchived();
  const remove = useDeleteAccount();

  const [tab, setTab] = useState<CategoryType>("expense");
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (!ledgerId || isPending || !accounts) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const categories = accounts.filter((a) => isCategory(a));
  const linesOf = (id: string) => balances?.get(id)?.line_count ?? 0;
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);
  const fail = (err: unknown) => toast.error(translateDbError(err));

  const handleMove = (category: Account, direction: "up" | "down") =>
    move.mutate({ ledgerId, id: category.id, direction }, { onError: fail });

  const handleArchive = (category: Account, archivedFlag: boolean) => {
    // 封存父類別時連同子類別一起
    const ids = archivedFlag ? [category.id, ...childrenOf(category.id).map((c) => c.id)] : [category.id];
    setArchived.mutate(
      { ledgerId, ids, archived: archivedFlag },
      { onSuccess: () => toast.success(archivedFlag ? "已封存" : "已取消封存"), onError: fail },
    );
  };

  const handleDelete = (category: Account) => {
    if (linesOf(category.id) > 0) {
      toast.error("有交易紀錄的類別只能封存，不能刪除");
      return;
    }
    if (childrenOf(category.id).length > 0) {
      toast.error("請先刪除或移走底下的子類別");
      return;
    }
    setDeleting(category);
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

  const renderTree = (type: CategoryType) => {
    const parents = categories.filter((c) => c.type === type && c.parent_id === null && !c.is_archived);
    if (parents.length === 0) {
      return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">還沒有類別</p>;
    }
    return parents.map((parent, index) => {
      const children = childrenOf(parent.id).filter((c) => !c.is_archived);
      return (
        <div key={parent.id} className="rounded-lg border">
          <CategoryRow
            category={parent}
            isFirst={index === 0}
            isLast={index === parents.length - 1}
            onMove={(dir) => handleMove(parent, dir)}
            onEdit={() => setDialog({ open: true, type, category: parent, parentId: null })}
            onAddChild={() => setDialog({ open: true, type, parentId: parent.id })}
            onArchive={() => handleArchive(parent, true)}
            onDelete={() => handleDelete(parent)}
          />
          {children.length > 0 && (
            <div className="border-t bg-muted/30 px-2 py-1">
              {children.map((child, childIndex) => (
                <CategoryRow
                  key={child.id}
                  category={child}
                  isChild
                  isFirst={childIndex === 0}
                  isLast={childIndex === children.length - 1}
                  onMove={(dir) => handleMove(child, dir)}
                  onEdit={() => setDialog({ open: true, type, category: child, parentId: child.parent_id })}
                  onArchive={() => handleArchive(child, true)}
                  onDelete={() => handleDelete(child)}
                />
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  const archivedOf = (type: CategoryType) => categories.filter((c) => c.type === type && c.is_archived);

  return (
    <>
      <PageHeader
        title="類別"
        description="收入與費用的分類，最多兩層。有交易紀錄的類別只能封存。"
        actions={
          <Button onClick={() => setDialog({ open: true, type: tab, parentId: null })}>
            <Plus className="size-4" aria-hidden />
            新增{tab === "expense" ? "費用" : "收入"}類別
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as CategoryType)}>
        <TabsList>
          <TabsTrigger value="expense">費用</TabsTrigger>
          <TabsTrigger value="revenue">收入</TabsTrigger>
        </TabsList>
        {(["expense", "revenue"] as const).map((type) => {
          const archived = archivedOf(type);
          return (
            <TabsContent key={type} value={type} className="grid gap-3">
              {renderTree(type)}
              {archived.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>已封存</CardTitle>
                      <CardDescription>封存的類別不會出現在記帳選單。</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                      {showArchived ? "收起" : `顯示 ${archived.length} 個`}
                    </Button>
                  </CardHeader>
                  {showArchived && (
                    <CardContent className="grid gap-2">
                      {archived.map((category) => (
                        <div key={category.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 opacity-80">
                          <AccountIcon icon={category.icon} color={category.color} size="sm" />
                          <span className="flex-1 truncate text-sm">
                            {category.parent_id ? `${categories.find((c) => c.id === category.parent_id)?.name ?? ""} › ` : ""}
                            {category.name}
                          </span>
                          <Button variant="outline" size="sm" onClick={() => handleArchive(category, false)}>
                            <ArchiveRestore className="size-4" aria-hidden />
                            取消封存
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {dialog.open && (
        <CategoryDialog
          open
          onOpenChange={(open) => !open && setDialog({ open: false })}
          ledgerId={ledgerId}
          type={dialog.type}
          category={dialog.category}
          defaultParentId={dialog.parentId}
          parentOptions={categories.filter(
            (c) => c.type === dialog.type && c.parent_id === null && !c.is_archived && c.id !== dialog.category?.id,
          )}
          hasChildren={dialog.category ? childrenOf(dialog.category.id).length > 0 : false}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`刪除「${deleting?.name ?? ""}」？`}
        description="這個類別沒有任何交易紀錄，刪除後無法復原。"
        confirmLabel="刪除"
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

interface CategoryRowProps {
  category: Account;
  isChild?: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
  onAddChild?: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function CategoryRow({ category, isChild, isFirst, isLast, onMove, onEdit, onAddChild, onArchive, onDelete }: CategoryRowProps) {
  return (
    <div className={isChild ? "flex items-center gap-3 py-1.5 pl-8 pr-1" : "flex items-center gap-3 px-3 py-2"}>
      <AccountIcon icon={category.icon} color={category.color} size={isChild ? "sm" : "md"} />
      <span className={isChild ? "min-w-0 flex-1 truncate text-sm" : "min-w-0 flex-1 truncate font-medium"}>
        {category.name}
        {category.type === "expense" && category.monthly_budget !== null && (
          <Badge variant="outline" className="ml-2 align-middle tabular-nums">
            基準線 {formatTWD(category.monthly_budget)}
          </Badge>
        )}
      </span>
      {!isChild && onAddChild && (
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={onAddChild}>
          <FolderPlus className="size-4" aria-hidden />
          子類別
        </Button>
      )}
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
          {!isChild && onAddChild && (
            <DropdownMenuItem className="sm:hidden" onClick={onAddChild}>
              <FolderPlus className="size-4" aria-hidden />
              新增子類別
            </DropdownMenuItem>
          )}
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

