import type { Metadata } from "next";
import Link from "next/link";
import { Tags, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "儀表板" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="儀表板" description="收支摘要、淨值與圖表會在里程碑 4 加入。" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <Wallet className="mb-2 size-6 text-muted-foreground" aria-hidden />
            <CardTitle>先設定帳戶與期初餘額</CardTitle>
            <CardDescription>確認現金、銀行、信用卡等帳戶都在，並填好開始記帳那天的金額。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/accounts" className={buttonVariants({ variant: "outline" })}>
              前往帳戶
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Tags className="mb-2 size-6 text-muted-foreground" aria-hidden />
            <CardTitle>整理收入與費用類別</CardTitle>
            <CardDescription>預設類別可以改名、加子類別或封存不用的項目。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/categories" className={buttonVariants({ variant: "outline" })}>
              前往類別
            </Link>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>接下來</CardTitle>
              <Badge variant="secondary">里程碑 2</Badge>
            </div>
            <CardDescription>記帳功能完成後，這裡會顯示本月收支、淨值變化與最近交易。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
