# financial — 互動式財報記帳平台

簡單記一筆帳，系統自動產生複式簿記分錄，並即時產出損益表、資產負債表與現金流量表。
新台幣單幣別、繁體中文介面。

## 功能藍圖

| 里程碑 | 內容 | 狀態 |
|---|---|---|
| 0 | 專案骨架、資料庫結構、CI、Vercel 上線 | ✅ |
| 1 | Email 登入、引導頁、帳戶與類別管理（圖示、顏色、排序、子類別）、期初餘額 | ✅（寄信需先完成 [docs/setup-email.md](docs/setup-email.md)） |
| 2 | 全站「記一筆」（算式金額、分錄預覽、再記一筆）、月份交易清單（篩選、搜尋、複製、批次刪除） | ✅ |
| 3 | 三大財報（損益表、資產負債表、現金流量表）、月／季／年／自訂期間、下鑽明細、即時連動 | ✅ |
| 4 | 筆記本體驗與視覺化：封面翻書、一天一頁、花過頭警示、記帳動畫、月章節頁圖表、UI 微調 | 規格已定 |
| 5 | 預算進度與儲蓄目標 | 待討論 |
| 6 | Google 登入、匯出備份、E2E 測試、安全審查 | 待討論 |

完整路線圖與記帳規則見 [docs/ROADMAP.md](docs/ROADMAP.md)。

## 外觀

手帳風設計：點格紙底、粉紅到桃紅的主題漸層、粉圓體與霞鶩文楷，含深淺色與四組主題色。
規則見 [docs/design.md](docs/design.md)；平台名稱改 `src/lib/brand.ts` 的 `BRAND_NAME`。

## 技術架構

- **前端**：Next.js 16（App Router、Cache Components）、React 19、TypeScript、Tailwind CSS v4、shadcn/ui
- **資料**：Supabase（Auth、Postgres、Row Level Security）、`@supabase/ssr`
- **狀態／表單／圖表**：TanStack Query、react-hook-form + zod、Recharts
- **測試**：Vitest（分錄規則等純邏輯）
- **部署**：Vercel（push `main` 自動部署）；GitHub Actions 跑 lint / test / build

### 核心概念：簡易輸入 → 複式分錄

使用者只看到「帳戶」（現金、銀行、信用卡…）與「類別」（薪資、飲食…），
每筆交易由 `src/lib/ledger/posting.ts` 轉成借貸平衡的分錄行，
資料庫端再由 `save_entry` RPC 原子寫入並以 constraint trigger 強制借貸相等。

| 交易 | 借方 | 貸方 |
|---|---|---|
| 支出 | 費用類別 | 來源帳戶 |
| 收入 | 去向帳戶 | 收入類別 |
| 轉帳 | 去向帳戶 | 來源帳戶 |
| 期初餘額 | 資產帳戶 ↔ 期初餘額（權益） | |

### 資料表（`supabase/migrations/`）

`profiles`、`ledgers`、`accounts`、`entries`、`entry_lines`、`budgets`、`goals`，
全部啟用 RLS，只有帳本擁有者能讀寫。報表由 `report_income_statement`、`report_balance_sheet`、`report_cash_flow`、`monthly_summary` 四個 SQL 函式計算（security invoker，同樣受 RLS 保護）。

## 本機開發

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 專案的 URL 與 publishable key
npm run dev                  # http://localhost:3000
```

常用指令：

```bash
npm run lint    # ESLint
npm test        # Vitest
npm run build   # 正式建置
```

### 本機測試登入

信箱驗證開啟時，本機測試可用 SQL 在 Supabase 建立一個已確認信箱的帳號
（參考 `docs/milestone-1.md` 實作備註），帳密放在 `.env.local` 的 `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`，不要提交到版控。

### 環境變數

| 變數 | 說明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key（可公開；service role key 絕不放進專案） |

### 資料庫 migration

migration SQL 放在 `supabase/migrations/`，檔名與 Supabase 上記錄的版號一致。
目前以 Supabase MCP／Dashboard 套用；之後也可用 `supabase link` + `supabase db push`。

## 部署

- **正式網址**：https://financial-xicheng.vercel.app
- **Supabase 專案**：`financial`（ref `marmxajzwymmuoakmgrx`，東京區）
- **Vercel**：專案 `financial`（團隊 `xicheng`）連結本 repo，push `main` 即部署正式環境、PR 產生 preview（preview 需 Vercel 登入才能看）

### 登入功能上線前需要在 Supabase Dashboard 手動設定（里程碑 1）

Authentication → URL Configuration：
- Site URL：Vercel 正式網址
- Redirect URLs：`https://<vercel-url>/auth/callback`、`http://localhost:3000/auth/callback`
