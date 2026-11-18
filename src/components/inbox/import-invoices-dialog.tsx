"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD } from "@/lib/ledger/format";
import { decodeInvoiceFile, parseInvoiceCsv, summarizeInvoices, type CsvInvoice, type CsvParseResult } from "@/lib/ledger/invoice-csv";
import { existingInvoiceNos, useImportInvoices } from "@/lib/ledger/invoice-import";

const MAX_BYTES = 5 * 1024 * 1024;

interface Parsed {
  fileName: string;
  result: CsvParseResult;
  fresh: CsvInvoice[];
  duplicates: number;
}

/** 匯入財政部載具消費明細檔：解析 → 摘要（新發票、已在帳本、作廢略過）→ 放進待確認匣 */
export function ImportInvoicesDialog({ open, onOpenChange, ledgerId }: { open: boolean; onOpenChange: (open: boolean) => void; ledgerId: string }) {
  const importInvoices = useImportInvoices();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const close = (next: boolean) => {
    if (importInvoices.isPending) return;
    if (!next) {
      setParsed(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const pick = async (file: File | undefined) => {
    setParsed(null);
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("檔案超過 5 MB，請一次匯入一兩個月就好");
    setReading(true);
    try {
      const result = parseInvoiceCsv(decodeInvoiceFile(new Uint8Array(await file.arrayBuffer())));
      if (!result.format) return setError(result.errors[0] ?? "讀不懂這個檔案");
      const existing = await existingInvoiceNos(
        ledgerId,
        result.invoices.map((i) => i.invoiceNo),
      );
      const fresh = result.invoices.filter((i) => !existing.has(i.invoiceNo));
      setParsed({ fileName: file.name, result, fresh, duplicates: result.invoices.length - fresh.length });
    } catch (err) {
      setError(translateDbError(err));
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    if (!parsed) return;
    try {
      const { added } = await importInvoices.mutateAsync({ ledgerId, invoices: parsed.fresh });
      toast.success(`已放進待確認匣 ${added} 張發票`);
      close(false);
    } catch (err) {
      setError(translateDbError(err));
    }
  };

  const summary = parsed ? summarizeInvoices(parsed.fresh) : null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>匯入載具明細</DialogTitle>
          <DialogDescription>
            到財政部電子發票整合服務平台，用手機條碼登入後下載「載具消費發票」的明細檔（CSV），或用每月寄到信箱的明細檔。發票會先放進待確認匣，已經記過的會自動略過。
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          aria-label="選擇載具明細檔"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" className="justify-self-start" disabled={reading || importInvoices.isPending} onClick={() => inputRef.current?.click()}>
          <FileUp className="size-4" aria-hidden />
          {reading ? "讀取中…" : "選擇明細檔…"}
        </Button>

        <FormError message={error ?? undefined} />

        {parsed && summary && (
          <section aria-label="明細檔內容" className="grid gap-2 rounded-xl border border-dashed border-line p-4 text-sm">
            <p className="font-bold">
              {parsed.fileName}（{parsed.result.format === "monthly" ? "每月寄送格式" : "官網下載格式"}）
            </p>
            <ul className="grid gap-1">
              <li>
                新發票 <strong className="tabular-nums">{summary.count}</strong> 張
                {summary.count > 0 && `，合計 ${formatTWD(summary.total)}（${summary.firstDate} ～ ${summary.lastDate}）`}
              </li>
              {parsed.duplicates > 0 && <li className="text-muted-foreground">已經在帳本或待確認匣：{parsed.duplicates} 張，會略過</li>}
              {parsed.result.voided > 0 && <li className="text-muted-foreground">作廢的發票：{parsed.result.voided} 張，會略過</li>}
              {summary.allowance > 0 && <li className="text-expense">有 {summary.allowance} 張發票有折讓，金額可能和實際付的不同，確認時再看一下</li>}
              {parsed.result.errors.length > 0 && (
                <li className="text-expense">
                  有 {parsed.result.errors.length} 行讀不懂，已略過：{parsed.result.errors.slice(0, 3).join("；")}
                  {parsed.result.errors.length > 3 && "…"}
                </li>
              )}
            </ul>
          </section>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={importInvoices.isPending}>
            取消
          </Button>
          <Button type="button" disabled={!parsed || parsed.fresh.length === 0 || importInvoices.isPending} onClick={() => void submit()}>
            {importInvoices.isPending ? "匯入中…" : parsed ? `放進待確認匣 ${parsed.fresh.length} 張` : "放進待確認匣"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
