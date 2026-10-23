"use client";

import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { evaluateAmount } from "@/lib/ledger/amount-expr";
import { formatTWD } from "@/lib/ledger/format";

interface AmountInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  /** 送出過一次後才顯示錯誤，避免打字途中一直紅 */
  showError?: boolean;
}

/** 金額欄：接受數字或算式，下方即時顯示結果或錯誤 */
export function AmountInput({ id, value, onChange, inputRef, showError }: AmountInputProps) {
  const result = evaluateAmount(value);
  const hasInput = value.trim() !== "";

  return (
    <div className="grid gap-1">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
        <Input
          id={id}
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0 或 120+35"
          className={cn("h-14 rounded-2xl border-2 border-primary pl-8 text-3xl font-bold tabular-nums", !result.ok && showError && "border-destructive")}
          aria-invalid={!result.ok && showError}
        />
      </div>
      {result.ok && result.isExpression && (
        <p className="font-hand text-[16px] text-primary tabular-nums">= {formatTWD(result.value)}</p>
      )}
      {!result.ok && hasInput && (
        <p className={cn("text-xs", showError ? "text-destructive" : "text-muted-foreground")}>{result.error}</p>
      )}
    </div>
  );
}
