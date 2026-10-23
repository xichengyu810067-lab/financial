import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const notoSansTC = Noto_Sans_TC({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "財報記帳平台",
    template: "%s｜財報記帳平台",
  },
  description: "簡單記一筆帳，系統自動產生複式分錄，即時產出損益表、資產負債表與現金流量表。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className={`${notoSansTC.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
