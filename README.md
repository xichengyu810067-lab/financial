# financial — 互動式財報記帳平台

簡單記一筆帳，系統自動產生複式簿記分錄，並即時產出損益表、資產負債表與現金流量表。
新台幣單幣別、繁體中文介面、手帳風設計。

- **正式網址**：https://financial-xicheng.vercel.app
- 路線圖與記帳規則：[docs/ROADMAP.md](docs/ROADMAP.md)；設計規則：[docs/design.md](docs/design.md)

## 功能總覽

| 畫面 | 位置 | 做什麼 |
|---|---|---|
| 登入／註冊 | `/login`、`/signup` | Email＋密碼（寄確認信）或 Google 登入；同信箱自動合併成同一個帳號 |
| 引導頁 | `/onboarding` | 第一次登入設定帳本名稱、起始日與各帳戶期初餘額 |
| 封面 | `/cover` | 筆記本封面（材質、顏色、標語），翻開進到今天這一頁 |
| 今天這一頁 | `/today`、`/days/YYYY-MM-DD` | 一天一頁：今日收支、比昨天多存多少、這個月還能花、儲蓄目標、當天交易 |
| 記一筆 | 每頁右下角 | 支出／收入／轉帳；金額可打算式（`120+35`）；分錄預覽；記完播動畫 |
| 本月 | `/month`、`/months/YYYY-MM` | 月章節頁：還能花多少、各類別進度與當月額度、圖表 |
| 交易清單 | `/transactions` | 依月份列出、篩選、搜尋備註、編輯、複製、批次刪除 |
| 帳戶／類別 | `/accounts`、`/categories` | 圖示、顏色、排序、子類別、封存、類別每月基準線 |
| 報表 | `/reports` | 損益表、資產負債表、現金流量表；日／週／月／季／年／自訂期間；點科目看明細；上方附圖 |
| 設定 | `/settings` | 帳本、封面、個人資料、外觀（深淺色、主題色、記帳動畫）、**備份與還原** |

## 技術架構

- **前端**：Next.js 16（App Router、Cache Components、`proxy.ts`）、React 19、TypeScript、Tailwind CSS v4、shadcn 風格元件（Base UI）
- **資料**：Supabase（Auth、Postgres、Row Level Security）、`@supabase/ssr`
- **狀態／表單／圖表**：TanStack Query、react-hook-form + zod、Recharts
- **測試**：Vitest（純邏輯）、SQL 測試（RLS 與備份還原）、Playwright（E2E）
- **部署**：Vercel（push `main` 自動部署）；GitHub Actions 跑 lint／test／build 與 SQL 測試

### 核心概念：簡易輸入 → 複式分錄

使用者只看到「帳戶」（現金、銀行、信用卡…）與「類別」（薪資、飲食…），
每筆交易由 `src/lib/ledger/posting.ts` 轉成借貸平衡的分錄行，
資料庫端再由 `save_entry` RPC 原子寫入，並以 constraint trigger 強制借貸相等。

| 交易 | 借方 | 貸方 |
|---|---|---|
| 支出 | 費用類別 | 來源帳戶 |
| 收入 | 去向帳戶 | 收入類別 |
| 轉帳 | 去向帳戶 | 來源帳戶 |
| 期初餘額 | 資產帳戶 ↔ 期初餘額（權益） | |

### 資料表（`supabase/migrations/`）

`profiles`、`ledgers`、`accounts`、`entries`、`entry_lines`、`budgets`、`goals`、`goal_deposits`，全部啟用 RLS，只有帳本擁有者能讀寫。
報表與統計由 SQL 函式計算（`report_income_statement`、`report_balance_sheet`、`report_cash_flow`、`monthly_summary`、`goal_progress` 等），一律 `security invoker`，同樣受 RLS 保護。

## 本機開發

需要 Node.js 20 以上與一個 Supabase 專案（免費方案即可）。

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 專案的 URL 與 publishable key
npm run dev                  # http://localhost:3000
```

### 環境變數（`.env.local`）

| 變數 | 說明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL（Dashboard → Project Settings → API） |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key，本來就會送到瀏覽器；**service role key 絕不放進專案** |
| `DEV_TEST_EMAIL`／`DEV_TEST_PASSWORD` | （選填）本機與 E2E 用的專用測試帳號，信箱網域必須是 `.test` |

## Supabase 設定

### 1. 資料庫

`supabase/migrations/` 依檔名順序就是完整的資料庫結構（含 RLS、trigger、RPC）。新專案可以：

```bash
npx supabase link --project-ref <你的專案 ref>
npx supabase db push
```

本機也可以 `npx supabase db start`（需要 Docker）起一個 Postgres 套用同一組 migration。

### 2. 登入

- **網址**：Authentication → URL Configuration
  - Site URL 填正式網址
  - Redirect URLs 加 `https://<正式網址>/**` 與 `http://localhost:3000/**`（要用萬用字元，回跳網址會帶參數）
- **寄信（確認信、重設密碼）**：Supabase 內建寄信每小時只有幾封，正式使用請照 [docs/setup-email.md](docs/setup-email.md) 接 Brevo SMTP
- **Google 登入**：照 [docs/setup-google.md](docs/setup-google.md) 建 Google OAuth 用戶端並在 Supabase 啟用；沒設定時登入頁按鈕會提示「尚未啟用」

### 3. 測試帳號（選填）

信箱驗證開啟時，可用 SQL 在 Supabase 建立一個已確認信箱的帳號（參考 [docs/milestone-1.md](docs/milestone-1.md) 實作備註），信箱用 `.test` 網域，帳密放 `.env.local`，不要提交到版控。

## 測試

```bash
npm run lint    # ESLint
npm test        # Vitest：分錄、報表、預算、目標、備份格式等純邏輯
npm run build   # 正式建置
```

### SQL 測試（`supabase/tests/`）

- `rls.sql`：兩位使用者互相讀不到、改不了、刪不掉、寫不進對方帳本；anon 什麼都拿不到
- `restore.sql`：備份還原回到備份時的狀態、壞檔被擋下且帳本不變、不能還原到別人的帳本

兩個檔案都在單一交易裡建立測試資料，全部通過時以 `ALL_OK` 例外結束並回滾，不留資料。CI 會用 Supabase CLI 起本機 Postgres 自動跑；手動跑：

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql 2>&1 | grep ALL_OK
```

### E2E（Playwright）

```bash
npx playwright install chromium   # 第一次
npm run e2e                       # 自動啟動 next dev，跑完看 playwright-report/
```

涵蓋：記一筆支出 → 今天這一頁與交易清單 → 編輯 → 刪除；本月還能花與類別當月額度；報表六種期間與三張圖；儲蓄目標存入到達標再封存；下載備份並檢查 JSON；登入、使用者選單、登出。

注意事項：

- **E2E 連正式 Supabase**，用 `.env.local` 的 `DEV_TEST_EMAIL` 登入，只能是專用測試帳號（信箱網域不是 `.test` 會拒絕執行）
- 測試建立的交易、目標、存入都以 `[E2E]` 開頭；開始前先清一次殘留，跑完自動刪除，並還原每月總支出上限、刪掉這次新增的預算
- 因為會寫正式資料庫，只在本機手動跑，**不放進 GitHub CI**
- 不測註冊（會真的寄信）、Google 登入（要真的 Google 帳號）、還原（會覆蓋測試帳本；由單元測試與 `restore.sql` 涵蓋）

## 備份與還原

設定頁的「備份與還原」：

- **下載備份**：整本帳本（帳戶、類別、交易、預算、目標、存入、帳本設定）存成 `帳本備份-YYYY-MM-DD.json`，建議每月存一份到雲端硬碟
- **從備份還原**：選擇備份檔 → 瀏覽器先檢查格式、參照與借貸平衡 → 顯示摘要 → 確認後由 `restore_ledger` 在同一個交易裡清空並重建目前帳本（所有 id 重新產生）；任何一步失敗整個回滾，帳本維持原樣
- 個人資料（顯示名稱、標語、動畫開關）會匯出但不會被還原

## 部署

- **Vercel**：專案連結本 repo，push `main` 部署正式環境，PR 產生 preview（preview 需 Vercel 登入才能看）；環境變數同 `.env.local` 的兩個 `NEXT_PUBLIC_*`
- **GitHub Actions**：
  - `ci.yml`：lint、test、build；`rls` job 用 Supabase CLI 跑兩個 SQL 測試
  - `keepalive.yml`：每天查一次資料庫，避免 Supabase 免費方案閒置被暫停；需要 repository variables `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`

## 已知限制

- 只有新台幣、一個使用者一本帳本（多帳本、多幣別不在範圍內）
- Supabase「外洩密碼防護」需要 Pro 方案，目前未開啟；密碼至少 8 碼並有登入頻率限制（見 [docs/milestone-6.md](docs/milestone-6.md)）
- Google 登入的同意畫面若維持「測試中」，只有加進測試使用者名單的 Google 帳號能用；要開放給所有人需在 Google Cloud 補首頁與隱私權政策後發布
- 還原在單一請求內完成，非常大的帳本（數萬筆交易）可能碰到 Supabase 的請求逾時
- 開發工具（shadcn CLI、vitest、typescript-eslint 等）有 `npm audit` 警告，不會進到網站，等上游更新
