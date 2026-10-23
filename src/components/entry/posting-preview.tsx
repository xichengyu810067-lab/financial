import { formatTWD } from "@/lib/ledger/format";
import type { Line } from "@/lib/ledger/posting";

interface PostingPreviewProps {
  lines: Line[] | null;
  nameOf: (accountId: string) => string;
}

/** 表單底部的分錄預覽：「借 飲食 $150 / 貸 現金 $150」 */
export function PostingPreview({ lines, nameOf }: PostingPreviewProps) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-muted-foreground">複式分錄預覽</p>
      {lines && lines.length > 0 ? (
        <ul className="grid gap-0.5 tabular-nums">
          {lines
            .filter((l) => l.debit > 0)
            .map((l) => (
              <li key={`d-${l.accountId}`}>
                借　{nameOf(l.accountId)}　{formatTWD(l.debit)}
              </li>
            ))}
          {lines
            .filter((l) => l.credit > 0)
            .map((l) => (
              <li key={`c-${l.accountId}`} className="pl-4">
                貸　{nameOf(l.accountId)}　{formatTWD(l.credit)}
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">填好金額、帳戶與類別後會顯示分錄。</p>
      )}
    </div>
  );
}
