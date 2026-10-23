import Link from "next/link";
import { ChartColumn, ReceiptText, Scale, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: ReceiptText,
    title: "簡單記一筆",
    description: "只要填收入、支出或轉帳，系統自動產生借貸平衡的複式分錄，不用懂會計也能有一套正規的帳。",
  },
  {
    icon: Scale,
    title: "三大財報即時更新",
    description: "損益表、資產負債表、現金流量表隨每筆交易即時重算，可切換月／季／年，並點擊科目下鑽到明細。",
  },
  {
    icon: ChartColumn,
    title: "儀表板一眼看懂",
    description: "收支趨勢、類別占比、淨值變化一次呈現，點圖表就能看到背後的交易。",
  },
  {
    icon: Target,
    title: "預算與目標",
    description: "設定每月類別預算與儲蓄目標，超支或達標都會提醒。",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6">
        <span className="text-lg font-semibold tracking-tight">財報記帳平台</span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            登入
          </Link>
          <Link href="/signup" className={buttonVariants()}>
            免費註冊
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 py-12">
        <section className="flex flex-col items-start gap-6">
          <Badge variant="secondary">里程碑 0：專案骨架已上線</Badge>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            簡單記一筆帳，
            <br />
            自動長出完整財報。
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            個人與家庭也能擁有正規的複式簿記：你只負責輸入，分錄、報表、圖表與預算追蹤都交給系統。
            新台幣單幣別，繁體中文介面。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              開始使用
            </Link>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
              看看儀表板
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="mb-2 size-6 text-muted-foreground" aria-hidden />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground">
        <span>新台幣單幣別・繁體中文介面</span>
        <a
          href="https://github.com/xichengyu810067-lab/financial"
          className="underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub 原始碼
        </a>
      </footer>
    </div>
  );
}
