"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/lib/ledger/queries";

/** 手機條碼畫成 Code 39（財政部手機條碼使用三九碼）；白底黑條，店員掃描器比較好讀 */
export function CarrierBarcode({ value, height = 90, className }: { value: string; height?: number; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("jsbarcode").then(({ default: JsBarcode }) => {
      if (cancelled || !svgRef.current) return;
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE39",
          height,
          width: 2,
          margin: 12,
          displayValue: true,
          fontSize: 20,
          background: "#ffffff",
          lineColor: "#000000",
        });
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value, height]);

  if (failed) return <p className="text-sm text-destructive">條碼格式不正確</p>;
  return <svg ref={svgRef} role="img" aria-label={`手機條碼 ${value}`} className={className} />;
}

/** 結帳時出示手機條碼：大大的白底條碼；還沒設定就引導到設定頁 */
export function CarrierBarcodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: profile } = useProfile();
  const barcode = profile?.carrier_barcode ?? null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>手機條碼</DialogTitle>
          <DialogDescription>{barcode ? "結帳時給店員掃這個條碼，發票就會存進你的載具。螢幕亮度調高比較好掃。" : "還沒設定手機條碼。"}</DialogDescription>
        </DialogHeader>
        {barcode ? (
          <div className="grid justify-items-center rounded-xl bg-white p-3">
            <CarrierBarcode value={barcode} height={110} className="h-auto w-full max-w-sm" />
          </div>
        ) : (
          <Link href="/settings#carrier" onClick={() => onOpenChange(false)} className="font-bold text-primary underline-offset-4 hover:underline">
            到設定頁輸入手機條碼 →
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
}
