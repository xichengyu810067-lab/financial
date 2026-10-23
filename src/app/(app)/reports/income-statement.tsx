"use client";

import { Fragment, useState } from "react";
import { formatPercent, formatTWD } from "@/lib/ledger/format";
import { monthsInPeriod, periodLabel, previousPeriod, type Period } from "@/lib/ledger/period";
import { buildIncomeStatement, percentOf, type IncomeLine, type IncomeSection } from "@/lib/ledger/report-model";
import { useIncomeStatement, useMonthlySummary } from "@/lib/ledger/reports";
import type { Account } from "@/lib/ledger/types";
import { sumAmounts, type DetailRequest } from "./drill";
import { MonthlyTable } from "./monthly-table";
import {
  DeltaCell,
  EmptyReport,
  LineRow,
  MoneyCell,
  PercentCell,
  ReportError,
  ReportSkeleton,
  ReportTable,
  SectionRow,
  SignedCell,
  StatTiles,
  TotalRow,
  type ReportColumn,
} from "./report-table";

interface IncomeStatementProps {
  ledgerId: string;
  accounts: Account[];
  period: Period;
  onDrill: (request: DetailRequest) => void;
}

const COLUMNS: ReportColumn[] = [
  { label: "類別", align: "left" },
  { label: "本期" },
  { label: "佔收入 %", hideOnMobile: true },
  { label: "上期", hideOnMobile: true },
  { label: "變化" },
];

type Tone = "income" | "expense";

export function IncomeStatement({ ledgerId, accounts, period, onDrill }: IncomeStatementProps) {
  const previous = previousPeriod(period);
  const currentQuery = useIncomeStatement(ledgerId, period.from, period.to);
  const previousQuery = useIncomeStatement(ledgerId, previous.from, previous.to);
  const showMonthly = period.preset === "year";
  const monthlyQuery = useMonthlySummary(ledgerId, period.from, period.to, showMonthly);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const error = currentQuery.error ?? previousQuery.error;
  if (error) return <ReportError message={error.message} />;
  if (!currentQuery.data || !previousQuery.data) return <ReportSkeleton />;

  const statement = buildIncomeStatement(currentQuery.data, previousQuery.data, accounts);
  const totalRevenue = statement.revenue.current;
  const label = periodLabel(period);
  const isEmpty = statement.revenue.lines.length === 0 && statement.expense.lines.length === 0;

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const drill = (line: IncomeLine, sectionLabel: string, tone: Tone) => {
    const ids = new Set([line.id, ...accounts.filter((a) => a.parent_id === line.id).map((a) => a.id)]);
    onDrill({
      title: line.name,
      subtitle: `${sectionLabel}・${label}`,
      period,
      match: (entry) => entry.category_id !== null && ids.has(entry.category_id),
      summarize: (entries) => [{ label: `${sectionLabel}合計`, value: sumAmounts(entries), tone }],
    });
  };

  const cells = (line: IncomeLine, colorize: boolean) => (
    <>
      <MoneyCell value={line.current} />
      <PercentCell value={percentOf(line.current, totalRevenue)} hideOnMobile />
      <MoneyCell value={line.previous} tone="muted" hideOnMobile />
      <DeltaCell current={line.current} previous={line.previous} colorize={colorize} />
    </>
  );

  const renderSection = (sectionLabel: string, section: IncomeSection, tone: Tone) => {
    // 收入增加是好事用綠色；費用增減沒有絕對好壞，用中性色
    const colorize = tone === "income";
    return (
      <>
        <SectionRow label={sectionLabel} colSpan={COLUMNS.length} />
        {section.lines.length === 0 && (
          <tr>
            <td colSpan={COLUMNS.length} className="px-2 py-3 text-sm text-muted-foreground">
              本期與上期都沒有{sectionLabel}。
            </td>
          </tr>
        )}
        {section.lines.map((line) => {
          const expanded = !collapsed.has(line.id);
          return (
            <Fragment key={line.id}>
              <LineRow
                name={line.name}
                icon={line.icon}
                color={line.color}
                expandable={line.children.length > 0}
                expanded={expanded}
                onToggle={() => toggle(line.id)}
                onSelect={() => drill(line, sectionLabel, tone)}
              >
                {cells(line, colorize)}
              </LineRow>
              {expanded &&
                line.children.map((child) => (
                  <LineRow key={child.id} depth={1} name={child.name} icon={child.icon} color={child.color} onSelect={() => drill(child, sectionLabel, tone)}>
                    {cells(child, colorize)}
                  </LineRow>
                ))}
            </Fragment>
          );
        })}
        <TotalRow label={`${sectionLabel}合計`}>
          <MoneyCell value={section.current} tone={tone} strong />
          <PercentCell value={percentOf(section.current, totalRevenue)} hideOnMobile />
          <MoneyCell value={section.previous} tone="muted" hideOnMobile />
          <DeltaCell current={section.current} previous={section.previous} colorize={colorize} />
        </TotalRow>
      </>
    );
  };

  const savingRate = percentOf(statement.netCurrent, totalRevenue);

  return (
    <div className="grid gap-5">
      <StatTiles
        items={[
          { label: "收入", value: statement.revenue.current, tone: "income", tape: "accent", hint: `上期 ${formatTWD(statement.revenue.previous)}` },
          { label: "支出", value: statement.expense.current, tone: "expense", tape: "mint", hint: `上期 ${formatTWD(statement.expense.previous)}` },
          {
            label: "淨利",
            value: statement.netCurrent,
            tone: statement.netCurrent < 0 ? "expense" : "none",
            stamp: "淨利",
            hint: savingRate === null ? "本期沒有收入" : `存下收入的 ${formatPercent(savingRate)}`,
          },
        ]}
      />

      {isEmpty ? (
        <EmptyReport text={`${label}沒有收入或支出，記一筆之後這裡就會長出損益表。`} />
      ) : (
        <ReportTable caption={`${label} 損益表`} columns={COLUMNS}>
          {renderSection("收入", statement.revenue, "income")}
          {renderSection("費用", statement.expense, "expense")}
          <TotalRow label="淨利" emphasis>
            <SignedCell value={statement.netCurrent} strong />
            <PercentCell value={savingRate} hideOnMobile />
            <SignedCell value={statement.netPrevious} colorize={false} hideOnMobile />
            <DeltaCell current={statement.netCurrent} previous={statement.netPrevious} />
          </TotalRow>
        </ReportTable>
      )}

      {showMonthly && <MonthlyTable months={monthsInPeriod(period)} rows={monthlyQuery.data} error={monthlyQuery.error?.message} />}
    </div>
  );
}
