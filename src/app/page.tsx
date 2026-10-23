import Link from "next/link";
import { ChartColumn, PenLine, Scale, Target } from "lucide-react";
import { DoodleUnderline } from "@/components/journal/doodle-underline";
import { Highlight } from "@/components/journal/highlight";
import { Logo } from "@/components/journal/logo";
import { StickyNote } from "@/components/journal/sticky-note";
import { WashiTape } from "@/components/journal/washi-tape";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND_TAGLINE } from "@/lib/brand";

const features = [
  {
    icon: PenLine,
    tone: "accent" as const,
    title: "簡單記一筆",
    description: "只要填收入、支出或轉帳，系統自動產生借貸平衡的複式分錄；金額還能直接打算式。",
  },
  {
    icon: Scale,
    tone: "mint" as const,
    title: "三大財報即時更新",
    description: "損益表、資產負債表、現金流量表隨每筆交易即時重算，可切換期間、點科目看明細。",
  },
  {
    icon: ChartColumn,
    tone: "sun" as const,
    title: "儀表板一眼看懂",
    description: "收支趨勢、類別占比、淨值變化一次呈現，點圖表就能看到背後的交易。",
  },
  {
    icon: Target,
    tone: "accent" as const,
    title: "預算與目標",
    description: "設定每月類別預算與儲蓄目標，超支或達標都會提醒。",
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
          <StickyNote>自己的帳，自己記。</StickyNote>
          <h1 className="max-w-2xl font-hand text-[44px] font-bold leading-tight sm:text-[56px]">
            簡單記一筆帳，
            <br />
            自動長出完整財報。
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            個人與家庭也能擁有正規的複式簿記：你只負責輸入，分錄、報表、圖表與預算追蹤都交給系統。
            <span className="mt-2 block">
              <Highlight>新台幣・繁體中文・免費</Highlight>
            </span>
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
          <DoodleUnderline width={220} className="-mt-2" />
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          {features.map(({ icon: Icon, tone, title, description }) => (
            <Card key={title}>
              <WashiTape tone={tone} />
              <CardHeader>
                <Icon className="mb-1 size-6 text-primary" aria-hidden />
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
    </div>
  );
}
