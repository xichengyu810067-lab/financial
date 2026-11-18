"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Barcode } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { CarrierBarcodeDialog } from "@/components/inbox/carrier-barcode";
import { InboxConfirmDialog } from "@/components/inbox/inbox-confirm-dialog";
import { InvoiceScanner } from "@/components/inbox/invoice-scanner";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { translateDbError } from "@/lib/ledger/errors";
import { formatTWD } from "@/lib/ledger/format";
import type { InboxItem } from "@/lib/ledger/inbox-model";
import type { ParsedInvoice } from "@/lib/ledger/invoice-qr";
import { DuplicateInvoiceError, useAddScannedInvoice } from "@/lib/ledger/invoice-scan";
import { useAccounts, useLedger } from "@/lib/ledger/queries";

type Mode = "single" | "batch";

/**
 * 掃發票：單張模式掃完直接開確認面板；連續模式一張張放進待確認匣，之後再一起確認。
 * 兩種都會先放進待確認匣（取消確認面板也不會遺失），同一張發票不會重複。
 */
export function ScanView() {
  const { data: ledger } = useLedger();
  const { data: accounts } = useAccounts(ledger?.id);
  const add = useAddScannedInvoice();
  const [mode, setMode] = useState<Mode>("single");
  const [confirming, setConfirming] = useState<InboxItem | null>(null);
  const [scanned, setScanned] = useState<InboxItem[]>([]);
  const [showBarcode, setShowBarcode] = useState(false);

  const ledgerId = ledger?.id;
  const onInvoice = useCallback(
    async (invoice: ParsedInvoice) => {
      if (!ledgerId) return;
      try {
        const item = await add.mutateAsync({ ledgerId, invoice });
        setScanned((list) => [item, ...list]);
        if (mode === "single") setConfirming(item);
        else toast.success(`已放進待確認匣：${item.merchant_name ?? item.invoice_no}・${formatTWD(Number(item.amount))}`);
      } catch (err) {
        if (err instanceof DuplicateInvoiceError) toast.warning(err.message);
        else toast.error(translateDbError(err));
      }
    },
    [add, ledgerId, mode],
  );

  if (!ledger || !accounts) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="aspect-[4/3] w-full rounded-[18px]" />
      </div>
    );
  }

  const radio = (active: boolean) =>
    cn("rounded-full px-4 py-1.5 text-sm font-bold transition-colors", active ? "bg-card shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground");

  return (
    <>
      <PageHeader
        title="掃發票"
        description="掃電子發票證明聯下方的兩個 QR Code，金額、日期、店家與品項會自動帶進來。"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setShowBarcode(true)}>
              <Barcode className="size-4" aria-hidden />
              出示手機條碼
            </Button>
            <Link href="/inbox" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              待確認匣 →
            </Link>
          </>
        }
      />

      <div className="mx-auto grid w-full max-w-xl gap-4">
        <div role="radiogroup" aria-label="掃描模式" className="mx-auto inline-flex gap-1 rounded-full bg-muted p-1">
          <button type="button" role="radio" aria-checked={mode === "single"} className={radio(mode === "single")} onClick={() => setMode("single")}>
            單張：掃完馬上確認
          </button>
          <button type="button" role="radio" aria-checked={mode === "batch"} className={radio(mode === "batch")} onClick={() => setMode("batch")}>
            連續：一疊掃完再確認
          </button>
        </div>

        <InvoiceScanner onInvoice={(inv) => void onInvoice(inv)} onMessage={(m) => toast.error(m)} paused={add.isPending || confirming !== null} />

        {scanned.length > 0 && (
          <section aria-label="這次掃到的發票" className="grid gap-2">
            <h2 className="text-sm font-bold text-muted-foreground">這次掃到 {scanned.length} 張</h2>
            <ul className="grid gap-1.5">
              {scanned.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border">
                  <span className="truncate">
                    {item.merchant_name ?? "（查不到店名）"}
                    <span className="ml-2 text-xs text-muted-foreground">{item.invoice_no}・{item.entry_date}</span>
                  </span>
                  <span className="font-bold tabular-nums">{formatTWD(Number(item.amount))}</span>
                </li>
              ))}
            </ul>
            {mode === "batch" && (
              <Link href="/inbox" className={cn(buttonVariants(), "justify-self-center")}>
                到待確認匣一起確認
              </Link>
            )}
          </section>
        )}
      </div>

      <InboxConfirmDialog item={confirming} onClose={() => setConfirming(null)} ledgerId={ledger.id} accounts={accounts} />
      <CarrierBarcodeDialog open={showBarcode} onOpenChange={setShowBarcode} />
    </>
  );
}
