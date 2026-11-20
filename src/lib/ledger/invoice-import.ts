"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";
import { unwrapRows } from "./db";
import { invalidateAfter } from "./invalidate";
import type { CsvInvoice } from "./invoice-csv";

const CHUNK = 100;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** 這些發票號碼裡，已經在待確認匣（含已確認、已略過）的有哪些 */
export async function existingInvoiceNos(ledgerId: string, invoiceNos: string[]): Promise<Set<string>> {
  const supabase = createClient();
  const found = new Set<string>();
  for (const part of chunks(invoiceNos)) {
    const rows = unwrapRows(await supabase.from("inbox_items").select("invoice_no").eq("ledger_id", ledgerId).in("invoice_no", part));
    for (const row of rows) if (row.invoice_no) found.add(row.invoice_no);
  }
  return found;
}

/**
 * 把載具明細檔的發票放進待確認匣：每家店（統編或店名）查一次分類建議，
 * 分批寫入，同一張發票已經在的略過（資料庫 unique 也會擋）。
 */
export function useImportInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ledgerId, invoices }: { ledgerId: string; invoices: CsvInvoice[] }) => {
      const supabase = createClient();
      const existing = await existingInvoiceNos(ledgerId, invoices.map((i) => i.invoiceNo));
      const fresh = invoices.filter((i) => !existing.has(i.invoiceNo));

      const merchantKey = (i: CsvInvoice) => i.sellerBan ?? i.merchantName ?? "";
      const suggestions = new Map<string, { category_id: string | null; account_id: string | null }>();
      for (const invoice of fresh) {
        const key = merchantKey(invoice);
        if (!key || suggestions.has(key)) continue;
        const { data } = await supabase
          .rpc("suggest_category", { p_ledger: ledgerId, p_merchant: invoice.merchantName ?? "", p_seller_ban: invoice.sellerBan ?? "" })
          .maybeSingle();
        suggestions.set(key, { category_id: data?.category_id ?? null, account_id: data?.account_id ?? null });
      }

      let added = 0;
      for (const part of chunks(fresh)) {
        const rows: TablesInsert<"inbox_items">[] = part.map((invoice) => {
          const suggestion = suggestions.get(merchantKey(invoice));
          return {
            ledger_id: ledgerId,
            source: "invoice_csv",
            kind: "expense",
            entry_date: invoice.date,
            amount: invoice.total,
            merchant_name: invoice.merchantName,
            seller_ban: invoice.sellerBan,
            invoice_no: invoice.invoiceNo,
            items: invoice.items as unknown as Json,
            category_id: suggestion?.category_id ?? null,
            from_account_id: suggestion?.account_id ?? null,
          };
        });
        const inserted = unwrapRows(
          await supabase.from("inbox_items").upsert(rows, { onConflict: "ledger_id,invoice_no", ignoreDuplicates: true }).select("id"),
        );
        added += inserted.length;
      }
      return { added, duplicates: invoices.length - added };
    },
    onSuccess: (_r, { ledgerId }) => invalidateAfter(queryClient, "inboxItem", ledgerId),
  });
}
