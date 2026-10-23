import Link from "next/link";
import { ChartColumn, NotebookPen, PenLine, Scale, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/journal/logo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND_TAGLINE } from "@/lib/brand";

const features = [
  {
    icon: NotebookPen,
    title: "一本翻得開的筆記本",
    description: "翻開就是今天這一頁：今天存了多少、花了多少、比昨天多存多少，一眼看懂。",
  },
  {
    icon: PenLine,
    title: "簡單記一筆",
    description: "只要填收入、支出或轉帳，系統自動產生借貸平衡的複式分錄；金額還能直接打算式。",
  },
  {
    icon: ShieldAlert,
    title: "花過頭會提醒",
    description: "替類別設一條每月基準線，照目前速度會超過就提早說，還附一句該怎麼辦。",
  },
  {
    icon: Scale,
    title: "三大財報即時更新",
    description: "損益表、資產負債表、現金流量表隨每筆交易即時重算，可切換期間、點科目看明細。",
  },
];

export default function Home() {
  return (
    <div className="paper-dots flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6">
        <Logo />
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
          <span className="font-hand text-lg text-muted-foreground">自己的帳，自己記。</span>
          <h1 className="max-w-2xl font-hand text-[44px] leading-tight font-bold sm:text-[56px]">
            簡單記一筆帳，
            <br />
            自動長出完整財報。
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            個人與家庭也能擁有正規的複式簿記：你只負責輸入，分錄、報表、圖表與提醒都交給系統。新台幣、繁體中文、免費。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              <PenLine className="size-5" aria-hidden />
              開始使用
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
              我有帳號
            </Link>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <span className="mb-1 inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-8 font-hand text-sm text-muted-foreground">
        <span>{BRAND_TAGLINE}</span>
        <a
          href="https://github.com/xichengyu810067-lab/financial"
          className="underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub 原始碼
        </a>
      </footer>
      <ChartColumn className="hidden" aria-hidden />
    </div>
  );
}
