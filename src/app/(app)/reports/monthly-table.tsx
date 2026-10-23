"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { shortMonthLabel } from "@/lib/ledger/period";
import { round2 } from "@/lib/ledger/report-model";
import type { MonthlySummaryRow } from "@/lib/ledger/reports";
import { MoneyCell, ReportError, ReportTable, SignedCell, TotalRow, type ReportColumn } from "./report-table";

const COLUMNS: ReportColumn[] = [{ label: "月份", align: "left" }, { label: "收入" }, { label: "支出" }, { label: "淨利" }];

interface MonthlyTableProps {
  /** 期間涵蓋的月份（YYYY-MM），沒有資料的月份顯示 0 */
  months: string[];
  rows: MonthlySummaryRow[] | undefined;
  error?: string;
}

/** 年度檢視下方的月度小表 */
export function MonthlyTable({ months, rows, error }: MonthlyTableProps) {
  const byMonth = new Map((rows ?? []).map((r) => [r.month, r]));
  const totalIncome = round2((rows ?? []).reduce((s, r) => s + r.income, 0));
  const totalExpense = round2((rows ?? []).reduce((s, r) => s + r.expense, 0));

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>月度明細</CardTitle>
        <CardDescription>這一年每個月的收入、支出與淨利。</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <ReportError message={error} />
        ) : !rows ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ReportTable caption="月度明細" columns={COLUMNS}>
            {months.map((month) => {
              const row = byMonth.get(month);
              const income = row?.income ?? 0;
              const expense = row?.expense ?? 0;
              return (
                <tr key={month} className="border-b border-dashed border-line last:border-0">
                  <td className="px-2 py-1.5 font-medium">{shortMonthLabel(month)}</td>
                  <MoneyCell value={income} tone={income > 0 ? "income" : "muted"} />
                  <MoneyCell value={expense} tone={expense > 0 ? "expense" : "muted"} />
                  <SignedCell value={round2(income - expense)} />
                </tr>
              );
            })}
            <TotalRow label="合計">
              <MoneyCell value={totalIncome} tone="income" strong />
              <MoneyCell value={totalExpense} tone="expense" strong />
              <SignedCell value={round2(totalIncome - totalExpense)} strong />
            </TotalRow>
          </ReportTable>
        )}
      </CardContent>
    </Card>
  );
}
