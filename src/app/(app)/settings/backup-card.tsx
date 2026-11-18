"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileCheck2, Upload } from "lucide-react";
import { toast } from "sonner";
import { FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadBackup, useRestoreLedger } from "@/lib/ledger/backup";
import { BACKUP_MAX_BYTES, parseBackup, type Backup, type BackupSummary } from "@/lib/ledger/backup-model";
import { translateDbError } from "@/lib/ledger/errors";

type Picked = { fileName: string; backup: Backup; summary: BackupSummary };

/** 備份與還原：下載整本帳本的 JSON；上傳備份檔 → 驗證 → 摘要 → 確認後覆蓋目前帳本 */
export function BackupCard({ ledgerId }: { ledgerId: string }) {
  const router = useRouter();
  const restore = useRestoreLedger();
  const inputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const count = await downloadBackup(ledgerId);
      toast.success(`已下載備份（${count} 筆交易）`);
    } catch (err) {
      toast.error(translateDbError(err));
    } finally {
      setDownloading(false);
    }
  };

  const pick = async (file: File | undefined) => {
    setPicked(null);
    setError(null);
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) return setError("檔案超過 5 MB，請確認選的是帳本備份");
    const result = parseBackup(await file.text());
    if (!result.ok) return setError(result.error);
    setPicked({ fileName: file.name, backup: result.backup, summary: result.summary });
  };

  const confirmRestore = () => {
    if (!picked) return;
    restore.mutate(
      { ledgerId, backup: picked.backup },
      {
        onSuccess: (data) => {
          setConfirming(false);
          setPicked(null);
          toast.success(`已從備份還原：${data.entries} 筆交易、${data.accounts} 個科目`);
          router.replace("/today");
        },
        onError: (err) => {
          setConfirming(false);
          setError(`還原失敗，帳本維持原樣：${translateDbError(err)}`);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>備份與還原</CardTitle>
        <CardDescription>整本帳本（帳戶、類別、交易、預算、目標與帳本設定）存成一個 JSON 檔；換電腦或資料出錯時可以從備份還原。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 pt-4 sm:grid-cols-2">
        <section className="grid content-start gap-2">
          <h3 className="text-sm font-bold text-muted-foreground">下載備份</h3>
          <p className="text-xs text-muted-foreground">檔名是「帳本備份-日期.json」。建議每個月下載一次，存到雲端硬碟。</p>
          <Button variant="outline" className="justify-self-start" disabled={downloading} onClick={() => void download()}>
            <Download className="size-4" aria-hidden />
            {downloading ? "準備中…" : "下載備份"}
          </Button>
        </section>

        <section className="grid content-start gap-2">
          <h3 className="text-sm font-bold text-muted-foreground">從備份還原</h3>
          <p className="text-xs text-muted-foreground">用備份的內容取代目前帳本；顯示名稱、標語等個人資料不會變。</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="選擇備份檔"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button variant="outline" className="justify-self-start" disabled={restore.isPending} onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" aria-hidden />
            選擇備份檔…
          </Button>
          <FormError message={error ?? undefined} />
        </section>

        {picked && (
          <section className="grid gap-3 rounded-xl border border-dashed border-line p-4 sm:col-span-2" aria-label="備份內容">
            <p className="flex items-center gap-2 text-sm font-bold">
              <FileCheck2 className="size-4 text-emerald-600" aria-hidden />
              {picked.fileName} 檢查通過
            </p>
            <SummaryList summary={picked.summary} />
            <Button variant="destructive" className="justify-self-start" disabled={restore.isPending} onClick={() => setConfirming(true)}>
              用這份備份還原…
            </Button>
          </section>
        )}
      </CardContent>

      <Dialog open={confirming} onOpenChange={(open) => !restore.isPending && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>用備份覆蓋目前帳本？</DialogTitle>
            <DialogDescription>
              目前帳本的帳戶、類別、交易、預算與目標都會換成備份的內容，<strong className="text-foreground">無法復原</strong>。還沒下載目前的備份的話，建議先下載一份。
            </DialogDescription>
          </DialogHeader>
          {picked && <SummaryList summary={picked.summary} />}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" disabled={downloading || restore.isPending} onClick={() => void download()}>
              <Download className="size-4" aria-hidden />
              {downloading ? "準備中…" : "先下載目前的備份"}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={restore.isPending} onClick={() => setConfirming(false)}>
                取消
              </Button>
              <Button type="button" variant="destructive" disabled={restore.isPending} onClick={confirmRestore}>
                {restore.isPending ? "還原中…" : "確定還原"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SummaryList({ summary }: { summary: BackupSummary }) {
  const exportedAt = new Date(summary.exportedAt);
  const rows: [string, string][] = [
    ["帳本", summary.ledgerName],
    ["備份時間", Number.isNaN(exportedAt.getTime()) ? summary.exportedAt : exportedAt.toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short" })],
    ["帳戶與類別", `帳戶 ${summary.accountCount} 個、類別 ${summary.categoryCount} 個`],
    ["交易", summary.firstDate ? `${summary.entryCount} 筆（${summary.firstDate} ～ ${summary.lastDate}）` : `${summary.entryCount} 筆`],
    ["預算與目標", `預算 ${summary.budgetCount} 筆、目標 ${summary.goalCount} 個（存入 ${summary.depositCount} 筆）`],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
