import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { formatTWD } from "@/lib/ledger/format";

interface MonthSummaryProps {
  income: number;
  expense: number;
}

export function MonthSummary({ income, expense }: MonthSummaryProps) {
  const net = income - expense;
  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="收入" value={income} className="text-income" />
      <Stat label="支出" value={expense} className="text-expense" />
      <Stat label="結餘" value={net} className={net < 0 ? "text-expense" : undefined} />
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card size="sm" className="py-3">
      <CardContent className="grid gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("truncate text-lg font-semibold tabular-nums", className)}>{formatTWD(value)}</span>
      </CardContent>
    </Card>
  );
}
