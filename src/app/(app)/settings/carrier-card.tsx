"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CarrierBarcode } from "@/components/inbox/carrier-barcode";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { translateDbError } from "@/lib/ledger/errors";
import { CARRIER_PATTERN } from "@/lib/ledger/invoice-scan";
import { useUpdateProfile } from "@/lib/ledger/queries";
import type { Profile } from "@/lib/ledger/types";

/** 手機條碼載具：只存條碼本身（/ 加 7 碼），不存驗證碼 */
export function CarrierCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [value, setValue] = useState(profile.carrier_barcode ?? "");
  const [error, setError] = useState<string | null>(null);
  const normalized = value.trim().toUpperCase();
  const valid = CARRIER_PATTERN.test(normalized);

  const save = async (barcode: string | null) => {
    if (barcode !== null && !CARRIER_PATTERN.test(barcode)) return setError("手機條碼是「/」加 7 個英數字或 + - . 符號，例如 /ABC+123");
    setError(null);
    try {
      await update.mutateAsync({ id: profile.id, carrier_barcode: barcode });
      toast.success(barcode ? "已儲存手機條碼" : "已清除手機條碼");
      if (!barcode) setValue("");
    } catch (err) {
      setError(translateDbError(err));
    }
  };

  return (
    <Card id="carrier">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(normalized);
        }}
      >
        <CardHeader>
          <CardTitle>手機條碼載具</CardTitle>
          <CardDescription>
            結帳時從右上角選單「出示手機條碼」給店員掃，發票就會存進財政部的載具。這裡只存條碼本身，不需要也不會存載具驗證碼。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <Field label="手機條碼" htmlFor="carrier-barcode" error={error ?? undefined} hint="「/」開頭共 8 碼，在財政部電子發票 App 或整合服務平台可以看到">
            <Input
              id="carrier-barcode"
              value={value}
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="/ABC+123"
              className="font-mono uppercase"
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          {valid && (
            <div className="rounded-xl bg-white p-2 ring-1 ring-border">
              <CarrierBarcode value={normalized} height={60} className="h-auto w-56" />
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {profile.carrier_barcode && (
            <Button type="button" variant="ghost" disabled={update.isPending} onClick={() => void save(null)}>
              清除
            </Button>
          )}
          <Button type="submit" disabled={update.isPending || normalized === (profile.carrier_barcode ?? "")}>
            {update.isPending ? "儲存中…" : "儲存"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
