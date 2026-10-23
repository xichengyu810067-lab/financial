"use client";

import { AccountIcon } from "@/components/account-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTWD } from "@/lib/ledger/format";
import type { Account, AccountBalance } from "@/lib/ledger/types";

interface AccountSelectProps {
  id?: string;
  accounts: Account[];
  balances?: Map<string, AccountBalance>;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

/** 帳戶選單：顯示圖示、名稱與目前餘額。轉帳兩邊不可相同由表單驗證負責。 */
export function AccountSelect({ id, accounts, balances, value, onChange, placeholder = "選擇帳戶" }: AccountSelectProps) {
  const items = accounts.map((a) => ({ value: a.id, label: a.name }));

  return (
    <Select value={value || null} items={items} onValueChange={(v) => onChange((v as string | null) ?? "")}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <span className="flex w-full items-center gap-2">
              <AccountIcon icon={a.icon} color={a.color} size="sm" />
              <span className="flex-1 truncate">{a.name}</span>
              {balances && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatTWD(Number(balances.get(a.id)?.balance ?? 0))}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
