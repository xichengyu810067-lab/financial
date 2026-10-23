"use client";

import { formatTWD } from "@/lib/ledger/format";
import { periodLabel, type Period } from "@/lib/ledger/period";
import { buildCashFlow, type CashFlowActivity, type CashFlowLine } from "@/lib/ledger/report-model";
import { useCashFlow } from "@/lib/ledger/reports";
import type { Account } from "@/lib/ledger/types";
import { cashDelta, summarizeDeltas, type DetailRequest } from "./drill";
import {
  CheckRow,
  EmptyCell,
  EmptyReport,
  LineRow,
  MoneyCell,
  ReportError,
  ReportSkeleton,
  ReportTable,
  SectionRow,
  SignedCell,
  StatTiles,
  TotalRow,
  type ReportColumn,
} from "./report-table";

interface CashFlowProps {
  ledgerId: string;
  accounts: Account[];
  period: Period;
  onDrill: (request: DetailRequest) => void;
}

/** 現金及等價物：資產帳戶中的現金、銀行、電子支付（與資料庫函式一致） */
export const CASH_SUBTYPES = new Set(["cash", "bank", "ewallet"]);

const COLUMNS: ReportColumn[] = [
  { label: "項目", align: "left" },
  { label: "流入", hideOnMobile: true },
  { label: "流出", hideOnMobile: true },
  { label: "淨額" },
];

export function CashFlow({ ledgerId, accounts, period, onDrill }: CashFlowProps) {
  const query = useCashFlow(ledgerId, period.from, period.to);
  if (query.error) return <ReportError message={query.error.message} />;
  if (!query.data) return <ReportSkeleton />;

  const statement = buildCashFlow(query.data);
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const cashAccounts = accounts.filter((a) => a.type === "asset" && CASH_SUBTYPES.has(a.subtype ?? ""));
  const cashIds = new Set(cashAccounts.map((a) => a.id));
  const label = periodLabel(period);
  const isEmpty = statement.activities.every((a) => a.lines.length === 0);

  const drill = (line: CashFlowLine, activity: CashFlowActivity) => {
    const counterpart = accountsById.get(line.id);
    const isOpening = counterpart?.type === "equity" && counterpart.is_system;
    const inCash = (id: string | null) => id !== null && cashIds.has(id);
    onDrill({
      title: line.name,
      subtitle: `${activity.label}・${label}`,
      period,
      match: (entry) => {
        if (entry.kind === "opening") return isOpening && inCash(entry.to_account_id);
        if (entry.category_id === line.id) return inCash(entry.from_account_id) || inCash(entry.to_account_id);
        if (entry.from_account_id === line.id) return inCash(entry.to_account_id);
        if (entry.to_account_id === line.id) return inCash(entry.from_account_id);
        return false;
      },
      summarize: (entries) =>
        summarizeDeltas(
          entries.map((e) => cashDelta(e, cashIds)),
          { up: "現金流入", down: "現金流出" },
        ),
    });
  };

  return (
    <div className="grid gap-5">
      <StatTiles
        items={[
          { label: "期初現金", value: statement.opening, tape: "sun", hint: `${period.from} 之前` },
          {
            label: "本期淨現金流量",
            value: statement.net,
            tone: statement.net < 0 ? "expense" : statement.net > 0 ? "income" : "none",
            tape: "accent",
            hint: statement.activities.map((a) => `${a.label.slice(0, 2)} ${formatTWD(a.net)}`).join("・"),
          },
          { label: "期末現金", value: statement.closing, stamp: "現金", hint: `${cashAccounts.length} 個現金類帳戶` },
        ]}
      />

      {isEmpty ? (
        <EmptyReport text={`${label}現金類帳戶沒有進出。只有動到現金、銀行或電子支付的交易才會出現在這裡。`} />
      ) : (
        <ReportTable caption={`${label} 現金流量表`} columns={COLUMNS}>
          {statement.activities.map((activity) => (
            <ActivityRows key={activity.key} activity={activity} onSelect={(line) => drill(line, activity)} />
          ))}
          <TotalRow label="本期淨現金流量" emphasis>
            <EmptyCell hideOnMobile />
            <EmptyCell hideOnMobile />
            <SignedCell value={statement.net} strong />
          </TotalRow>
          <tr className="border-b border-dashed border-line">
            <td className="px-2 py-2 text-muted-foreground">期初現金</td>
            <EmptyCell hideOnMobile />
            <EmptyCell hideOnMobile />
            <MoneyCell value={statement.opening} tone="muted" />
          </tr>
          <tr>
            <td className="px-2 py-2 font-bold">期末現金</td>
            <EmptyCell hideOnMobile />
            <EmptyCell hideOnMobile />
            <MoneyCell value={statement.closing} strong />
          </tr>
          <CheckRow label="期初現金 + 淨現金流量 = 期末現金" difference={statement.check} colSpan={COLUMNS.length} />
        </ReportTable>
      )}
    </div>
  );
}

function ActivityRows({ activity, onSelect }: { activity: CashFlowActivity; onSelect: (line: CashFlowLine) => void }) {
  return (
    <>
      <SectionRow label={activity.label} description={activity.description} colSpan={COLUMNS.length} />
      {activity.lines.length === 0 && (
        <tr>
          <td colSpan={COLUMNS.length} className="px-2 py-3 text-sm text-muted-foreground">
            本期沒有{activity.label}。
          </td>
        </tr>
      )}
      {activity.lines.map((line) => (
        <LineRow key={line.id} name={line.name} icon={line.icon} color={line.color} onSelect={() => onSelect(line)}>
          <MoneyCell value={line.inflow} tone={line.inflow > 0 ? "income" : "muted"} hideOnMobile />
          <MoneyCell value={line.outflow} tone={line.outflow > 0 ? "expense" : "muted"} hideOnMobile />
          <SignedCell value={line.net} />
        </LineRow>
      ))}
      <TotalRow label={`${activity.label}小計`}>
        <MoneyCell value={activity.inflow} tone="income" strong hideOnMobile />
        <MoneyCell value={activity.outflow} tone="expense" strong hideOnMobile />
        <SignedCell value={activity.net} strong />
      </TotalRow>
    </>
  );
}
