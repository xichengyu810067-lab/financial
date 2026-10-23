import type { ReactNode } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** 標籤 + 輸入元件 + 提示／錯誤文字的最小表單欄位包裝 */
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** 表單層級的錯誤訊息 */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
