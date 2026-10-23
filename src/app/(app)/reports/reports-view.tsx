"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayISO } from "@/lib/ledger/format";
import { periodFromParams, periodToParams, type Period } from "@/lib/ledger/period";
import { useAccounts, useLedger } from "@/lib/ledger/queries";
import { BalanceSheet } from "./balance-sheet";
import { CashFlow } from "./cash-flow";
import { DetailSheet } from "./detail-sheet";
import type { DetailRequest } from "./drill";
import { IncomeStatement } from "./income-statement";
import { PeriodPicker } from "./period-picker";

const TABS = [
  { value: "income", label: "損益表" },
  { value: "balance", label: "資產負債表" },
  { value: "cashflow", label: "現金流量表" },
] as const;

type ReportTab = (typeof TABS)[number]["value"];

const isTab = (value: string | null): value is ReportTab => TABS.some((t) => t.value === value);

/**
 * 報表頁：分頁與期間都放在網址（?tab=&preset=&from=&to=），重新整理或分享連結都能回到同一張表。
 * 點任一列會開右側明細面板；面板裡點交易再開記帳面板編輯，存檔後報表與明細一起重算。
 */
export function ReportsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = todayISO();
  const tabParam = searchParams.get("tab");
  const tab: ReportTab = isTab(tabParam) ? tabParam : "income";
  const period = periodFromParams(
    { preset: searchParams.get("preset"), from: searchParams.get("from"), to: searchParams.get("to") },
    today,
  );

  const { data: ledger } = useLedger();
  const ledgerId = ledger?.id;
  const { data: accounts } = useAccounts(ledgerId);

  const [detail, setDetail] = useState<DetailRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const navigate = (nextTab: ReportTab, nextPeriod: Period) => {
    const params = new URLSearchParams({ tab: nextTab, ...periodToParams(nextPeriod) });
    router.replace(`/reports?${params.toString()}`);
  };

  const openDetail = (request: DetailRequest) => {
    setDetail(request);
    setDetailOpen(true);
  };

  if (!ledgerId || !accounts) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full rounded-[22px]" />
      </div>
    );
  }

  const reportProps = { ledgerId, accounts, period, onDrill: openDetail };

  return (
    <>
      <PageHeader title="報表" description="三張報表會隨每一筆交易即時更新；點任一列可以看到背後的交易。" />

      <div className="grid gap-4">
        <PeriodPicker period={period} today={today} onChange={(next) => navigate(tab, next)} />

        <Tabs value={tab} onValueChange={(value) => navigate(value as ReportTab, period)}>
          <TabsList aria-label="報表種類">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="income">
            <IncomeStatement {...reportProps} />
          </TabsContent>
          <TabsContent value="balance">
            <BalanceSheet {...reportProps} />
          </TabsContent>
          <TabsContent value="cashflow">
            <CashFlow {...reportProps} />
          </TabsContent>
        </Tabs>
      </div>

      <DetailSheet request={detail} open={detailOpen} onClose={() => setDetailOpen(false)} ledgerId={ledgerId} accounts={accounts} />
    </>
  );
}
