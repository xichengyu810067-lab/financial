import type { Metadata } from "next";
import "@fontsource/huninn";
import "lxgw-wenkai-tc-webfont/lxgwwenkaitc-regular.css";
import "lxgw-wenkai-tc-webfont/lxgwwenkaitc-bold.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider, accentInitScript } from "@/components/theme-provider";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s｜${BRAND_NAME}`,
  },
  description: BRAND_TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: accentInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
