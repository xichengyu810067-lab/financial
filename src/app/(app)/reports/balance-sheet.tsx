"use client";

import { Badge } from "@/components/ui/badge";
import { formatTWD } from "@/lib/ledger/format";
import { dayBefore, periodLabel, type Period } from "@/lib/ledger/period";
import { buildBalanceSheet, RETAINED_KEY, round2, type BalanceLine, type BalanceSection } from "@/lib/ledger/report-model";
import { useBalanceSheet } from "@/lib/ledger/reports";
import type { Account } from "@/lib/ledger/types";
import { accountDelta, sumAmounts, summarizeDeltas, type DetailRequest } from "./drill";
import {
  CheckRow,
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

interface BalanceSheetProps {
  ledgerId: string;
  accounts: Account[];
  period: Period;
  onDrill: (request: DetailRequest) => void;
}

/** "2026-01-31" → "1/31" */
const shortDate = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export function BalanceSheet({ ledgerId, accounts, period, onDrill }: BalanceSheetProps) {
  const startDate = dayBefore(period.from);
  const endQuery = useBalanceSheet(ledgerId, period.to);
  const startQuery = useBalanceSheet(ledgerId, startDate);

  const error = endQuery.error ?? startQuery.error;
  if (error) return <ReportError message={error.message} />;
  if (!endQuery.data || !startQuery.data) return <ReportSkeleton />;

  const sheet = buildBalanceSheet(endQuery.data, startQuery.data);
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const label = periodLabel(period);
  const columns: ReportColumn[] = [
    { label: "帳戶", align: "left" },
    { label: `期末 ${shortDate(period.to)}` },
    { label: `期初 ${shortDate(startDate)}`, hideOnMobile: true },
    { label: "變化" },
  ];
  const isEmpty = sheet.assets.lines.length === 0 && sheet.liabilities.lines.length === 0;

  const drill = (line: BalanceLine, sectionLabel: string) => {
    if (line.key === RETAINED_KEY) {
      onDrill({
        title: "累積損益",
        subtitle: `${label} 的收入與支出`,
        period,
        match: (entry) => entry.kind === "income" || entry.kind === "expense",
        summarize: (entries) => {
          const income = sumAmounts(entries.filter((e) => e.kind === "income"));
          const expense = sumAmounts(entries.filter((e) => e.kind === "expense"));
          return [
            { label: "收入", value: income, tone: "income" },
            { label: "支出", value: expense, tone: "expense" },
            { label: "本期淨利", value: round2(income - expense) },
          ];
        },
      });
      return;
    }
    const id = line.id!;
    const account = accountsById.get(id);
    if (account?.type === "equity") {
      // 期初餘額：列出期間內設定的所有期初餘額
      onDrill({
        title: line.name,
        subtitle: `${label} 內設定的期初餘額`,
        period,
        match: (entry) => entry.kind === "opening",
        summarize: (entries) => {
          const typeOf = (entry: (typeof entries)[number]) => (entry.to_account_id ? accountsById.get(entry.to_account_id)?.type : undefined);
          const assets = sumAmounts(entries.filter((e) => typeOf(e) === "asset"));
          const liabilities = sumAmounts(entries.filter((e) => typeOf(e) === "liability"));
          return [
            { label: "資產期初", value: assets, tone: "income" },
            { label: "負債期初", value: liabilities, tone: "expense" },
            { label: "期初餘額淨額", value: round2(assets - liabilities) },
          ];
        },
      });
      return;
    }
    const type = account?.type ?? "asset";
    onDrill({
      title: line.name,
      subtitle: `${sectionLabel}・${label}`,
      period,
      match: (entry) => entry.from_account_id === id || entry.to_account_id === id,
      summarize: (entries) =>
        summarizeDeltas(
          entries.map((e) => accountDelta(e, id, type)),
          type === "liability" ? { up: "新增負債", down: "償還" } : { up: "流入", down: "流出" },
        ),
    });
  };

  const renderSection = (sectionLabel: string, section: BalanceSection, options: { invert?: boolean; description?: string } = {}) => (
    <>
      <SectionRow label={sectionLabel} description={options.description} colSpan={columns.length} />
      {section.lines.length === 0 && (
        <tr>
          <td colSpan={columns.length} className="px-2 py-3 text-sm text-muted-foreground">
            沒有{sectionLabel}帳戶。
          </td>
        </tr>
      )}
      {section.lines.map((line) => (
        <LineRow
          key={line.key}
          name={line.name}
          icon={line.key === RETAINED_KEY ? undefined : line.icon}
          color={line.color}
          tags={line.isArchived ? <Badge variant="outline">已封存</Badge> : undefined}
          onSelect={() => drill(line, sectionLabel)}
        >
          <MoneyCell value={line.end} />
          <MoneyCell value={line.start} tone="muted" hideOnMobile />
          <SignedCell value={line.change} invert={options.invert} />
        </LineRow>
      ))}
      <TotalRow label={`${sectionLabel}合計`}>
        <MoneyCell value={section.end} strong />
        <MoneyCell value={section.start} tone="muted" hideOnMobile />
        <SignedCell value={round2(section.end - section.start)} invert={options.invert} strong />
      </TotalRow>
    </>
  );

  return (
    <div className="grid gap-5">
      <StatTiles
        items={[
          { label: "資產", value: sheet.assets.end, tape: "accent", hint: `期初 ${formatTWD(sheet.assets.start)}` },
          { label: "負債", value: sheet.liabilities.end, tape: "sun", hint: `期初 ${formatTWD(sheet.liabilities.start)}` },
          { label: "淨值", value: sheet.netWorth.end, stamp: "淨值", hint: `期初 ${formatTWD(sheet.netWorth.start)}` },
        ]}
      />

      {isEmpty ? (
        <EmptyReport text="還沒有帳戶，先到「帳戶」頁建立並設定期初餘額。" />
      ) : (
        <ReportTable caption={`截至 ${period.to} 的資產負債表`} columns={columns}>
          {renderSection("資產", sheet.assets)}
          {renderSection("負債", sheet.liabilities, { invert: true })}
          {renderSection("權益", sheet.equity, { description: "期初餘額 + 開帳以來的累積損益" })}
          <CheckRow label="資產 − 負債 − 權益 = 0" difference={sheet.check.end} colSpan={columns.length} />
          <TotalRow label="淨值（資產 − 負債）" emphasis>
            <MoneyCell value={sheet.netWorth.end} strong />
            <MoneyCell value={sheet.netWorth.start} tone="muted" hideOnMobile />
            <SignedCell value={round2(sheet.netWorth.end - sheet.netWorth.start)} strong />
          </TotalRow>
        </ReportTable>
      )}
    </div>
  );
}
