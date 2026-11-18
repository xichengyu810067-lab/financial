"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { inboxKeys } from "./inbox";
import type { InboxItem } from "./inbox-model";
import type { ParsedInvoice } from "./invoice-qr";

/** 手機條碼格式：/ 加 7 碼（0-9、A-Z、+、-、.） */
export const CARRIER_PATTERN = /^\/[0-9A-Z.+-]{7}$/;

export class DuplicateInvoiceError extends Error {
  constructor(public invoiceNo: string) {
    super(`發票 ${invoiceNo} 已經記過了（或已在待確認匣）`);
    this.name = "DuplicateInvoiceError";
  }
}

/** 統編 → 店名：先看這本帳本記過的店家，沒有再請伺服器查經濟部公開資料 */
async function merchantName(ledgerId: string, ban: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("merchants").select("name").eq("ledger_id", ledgerId).eq("merchant_key", ban).maybeSingle();
  if (data?.name) return data.name;
  try {
    const res = await fetch(`/api/merchants?ban=${ban}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { name: string | null };
    return body.name;
  } catch {
    return null;
  }
}

/** 掃到的發票放進待確認匣：查店名、照規則或店家記憶預選類別與付款帳戶；同一張發票只會放一次 */
export function useAddScannedInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ledgerId, invoice }: { ledgerId: string; invoice: ParsedInvoice }): Promise<InboxItem> => {
      const supabase = createClient();
      const existing = await supabase.from("inbox_items").select("id").eq("ledger_id", ledgerId).eq("invoice_no", invoice.invoiceNo).maybeSingle();
      if (existing.data) throw new DuplicateInvoiceError(invoice.invoiceNo);

      const name = await merchantName(ledgerId, invoice.sellerBan);
      const { data: suggestion } = await supabase
        .rpc("suggest_category", { p_ledger: ledgerId, p_merchant: name ?? "", p_seller_ban: invoice.sellerBan })
        .maybeSingle();

      const { data, error } = await supabase
        .from("inbox_items")
        .insert({
          ledger_id: ledgerId,
          source: "invoice_qr",
          kind: "expense",
          entry_date: invoice.date,
          amount: invoice.totalAmount,
          merchant_name: name,
          seller_ban: invoice.sellerBan,
          invoice_no: invoice.invoiceNo,
          items: invoice.items as unknown as Json,
          category_id: suggestion?.category_id ?? null,
          from_account_id: suggestion?.account_id ?? null,
        })
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") throw new DuplicateInvoiceError(invoice.invoiceNo);
        throw new Error(error.message);
      }
      return { ...data, amount: Number(data.amount) };
    },
    onSuccess: (_item, { ledgerId }) => queryClient.invalidateQueries({ queryKey: inboxKeys.pending(ledgerId) }),
  });
}
