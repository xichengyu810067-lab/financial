# 里程碑 1：登入與帳本 — 規格

討論日期：2026-10-23。本文件是實作依據；完成後更新 `docs/ROADMAP.md` 狀態。

## 已確認的決策

| 項目 | 決定 |
|---|---|
| 信箱驗證 | 一開始就開啟（Supabase「Confirm email」維持預設開啟），寄信走 **Brevo** 自訂 SMTP（免網域，驗證寄件信箱即可） |
| 首次建帳本 | 註冊時由資料庫 trigger 自動建立帳本與預設科目；首次登入先走 `/onboarding` 引導頁 |
| 登入附加 | 忘記密碼／重設密碼、註冊時填顯示名稱、持久登入（Supabase 預設 refresh token，不做「關閉即登出」） |
| 管理畫面 | 圖示選擇（約 24 個）、顏色選擇（10 色）、手動排序（上下移動）、類別支援二層（子類別） |
| 帳本數 | MVP 每位使用者一個帳本；資料表已支援多帳本，切換功能之後再開 |

## 使用者流程

1. **註冊 `/signup`**：顯示名稱、Email、密碼（至少 8 碼）、確認密碼。送出後顯示「確認信已寄到 ○○○」並提供重寄按鈕。
2. **點信中連結** → `/auth/callback?code=…&next=/onboarding` 交換 session → 導到 `/onboarding`。
3. **引導頁 `/onboarding`**（一頁兩區塊）
   - 帳本名稱（預設「我的帳本」）、起始日（預設今天）。
   - 帳戶清單：預設的現金、銀行存款、電子支付、投資、信用卡，每列可取消勾選、改名、填期初餘額。
   - 完成 → 一次寫入（改名、刪除未勾選帳戶、建立期初分錄、標記已完成引導）→ `/dashboard`。
4. **登入 `/login`**：Email、密碼、「忘記密碼？」連結。成功後導到 `next` 參數或 `/dashboard`；未完成引導者導到 `/onboarding`。
5. **忘記密碼 `/forgot-password`** → 寄重設信 → 點連結 → `/auth/callback?next=/reset-password` → **`/reset-password`** 設新密碼 → `/dashboard`。
6. **登出**：右上使用者選單 → Server Action `signOut` → `/login`。

錯誤訊息一律轉繁中：帳號或密碼錯誤、此信箱已註冊、密碼至少 8 碼、信箱尚未確認、連結已失效請重新申請。

## 路由保護

- `src/proxy.ts`：刷新 session 後套規則
  - 受保護：`/dashboard` `/transactions` `/accounts` `/categories` `/reports` `/budgets` `/settings` `/onboarding` → 未登入導到 `/login?next=<原路徑>`
  - 已登入訪問 `/login` `/signup` `/forgot-password` `/` → `/dashboard`（`/reset-password` 例外，需登入狀態才能改密碼）
- `(app)/layout.tsx`（Server Component，Suspense 內）：讀 `profiles.onboarded_at`，為空且不在 `/onboarding` → 導到 `/onboarding`；已完成卻開 `/onboarding` → `/dashboard`。
- 表單用 Server Action（`src/app/(auth)/actions.ts`）處理註冊、登入、登出、寄重設信、改密碼；cookie 由伺服器寫入。
- 各頁資料用瀏覽器端 Supabase client + TanStack Query（RLS 保護）；寫入後 invalidate 查詢鍵即為「即時連動」。

## 頁面與元件

| 路徑 | 內容 |
|---|---|
| `(app)/layout.tsx` | 桌機左側導覽（儀表板、交易、帳戶、類別、報表、預算、設定）、手機改抽屜（Sheet）；頂欄顯示帳本名稱與使用者選單（顯示名稱、設定、登出） |
| `/accounts` | 「資產」「負債」兩區。每列：圖示＋顏色、名稱、子類型標籤、目前餘額、上移／下移、編輯、封存或刪除。新增／編輯對話框：名稱、類型（資產／負債）、子類型（現金／銀行／電子支付／投資／信用卡／貸款／其他）、圖示、顏色、期初餘額 |
| `/categories` | 「收入」「費用」兩個分頁，樹狀列表（父類別可展開子類別）。每列：圖示＋顏色、名稱、上移／下移（同層內）、新增子類別（僅父層）、編輯、封存。對話框：名稱、圖示、顏色、父類別（選填，只能選無父層的同類型類別） |
| `/settings` | 帳本名稱、起始日、顯示名稱、登出 |
| `/dashboard` | 仍為空殼，但加一張提示卡：「先到帳戶頁設定期初餘額、到類別頁調整類別」 |

共用元件：`IconPicker`（約 24 個 lucide 圖示，附中文名稱）、`ColorPicker`（10 個預設色 token）、`useLedger()`（帳本、科目清單、餘額；TanStack Query）、`AccountIcon`（依 icon／color 渲染）。

### 規則細節

- **期初餘額**：每個帳戶最多一筆 `kind = 'opening'` 的交易，日期固定為帳本起始日，對方科目為系統科目「期初餘額」（權益）。改金額就更新那筆；清成 0 就刪除。起始日變更時，所有期初交易的日期一併改。
- **封存 vs 刪除**：有分錄的科目只能封存；沒有分錄可刪除。系統科目（期初餘額）不顯示、不可改。封存父類別時子類別一併封存。
- **子類別**：只有收入／費用類別可有父層，最多兩層（父層本身不能再有父層）。交易可記在父類別或子類別；報表以父類別彙總、可展開子類別。
- **排序**：同層內以 `sort_order` 排序，上移／下移交換相鄰兩列的值。
- **圖示／顏色**：`accounts.icon` 存 lucide 圖示名稱，`accounts.color` 存預設色 token（例如 `rose`、`emerald`）；之後圖表配色沿用。

## 資料庫變更（新 migration）

- `ledgers.start_date date not null default current_date`
- `profiles.onboarded_at timestamptz`
- `accounts.parent_id uuid references accounts(id) on delete restrict`；唯一鍵改為 `unique nulls not distinct (ledger_id, parent_id, name)`；trigger 檢查父層同帳本、同類型、僅收入／費用、父層本身無父層
- `handle_new_user` 改為同時呼叫 `seed_ledger(p_owner uuid, p_name text)`（security definer、對外全部 revoke），`create_ledger_with_defaults` 改成呼叫 `seed_ledger(auth.uid(), p_name)`；預設科目補上圖示與顏色
- `ledgers` 的 `start_date` 更新 trigger：同步所有 opening 交易日期
- 檢視表 `account_balances`（`security_invoker = true`）：`account_id`、`ledger_id`、`balance`（依正常餘額方向）、`entry_count`
- RPC `set_opening_balance(p_account_id uuid, p_amount numeric) returns uuid`：找／建／刪該帳戶的期初交易
- RPC `complete_onboarding(p_name text, p_start_date date, p_accounts jsonb) returns void`：`p_accounts = [{ id, name, keep, opening_amount }]`，一次完成改名、刪除、期初分錄與 `onboarded_at`
- RPC `move_account(p_account_id uuid, p_direction text)`：同層內交換 `sort_order`

## 需要使用者在 Dashboard 手動完成的設定

MCP 沒有 Auth 與 SMTP 的設定工具，以下由你操作（我可以提供每一步的截圖指引或在內建瀏覽器陪你走，但 SMTP 金鑰必須由你自己輸入）。

1. **Brevo**：註冊帳號 → Senders & IP → 新增並驗證寄件信箱 → SMTP & API → 建立 SMTP key。記下：`smtp-relay.brevo.com`、port `587`、登入帳號（Brevo 帳號 email）、SMTP key。
2. **Supabase → Authentication → Emails → SMTP Settings**：啟用 Custom SMTP，填入上述資訊，Sender name 填「財報記帳平台」。
3. **Supabase → Authentication → URL Configuration**：
   - Site URL：`https://financial-xicheng.vercel.app`
   - Redirect URLs：`https://financial-xicheng.vercel.app/auth/callback`、`http://localhost:3000/auth/callback`、`https://*-xicheng.vercel.app/auth/callback`（preview 用）
4. **Supabase → Authentication → Emails → Templates**（選做）：確認信與重設密碼信改成繁中，範本文字由我提供。
5. **Supabase → Authentication → Sign In / Providers → Email**：確認「Confirm email」為開啟（預設）。

## 驗收

- 註冊 → 收到 Brevo 寄出的確認信 → 點連結進引導頁 → 完成 → 儀表板顯示提示卡。
- 帳戶頁：新增帳戶並設期初餘額 10,000 → 餘額 10,000；改成 0 → 餘額 0 且期初交易被刪除。
- 類別頁：新增子類別、上下移動、封存父類別時子類別一併封存；父類別不能被選為另一個子類別的父層。
- 未登入開 `/dashboard` → `/login?next=/dashboard`，登入後回到 `/dashboard`。
- 忘記密碼信寄達，重設後能以新密碼登入。
- SQL 測試（可 rollback）：註冊 trigger 建立帳本與科目、`complete_onboarding`、`set_opening_balance`、父層深度限制、RLS 隔離。
- 本機 lint／test／build 通過、CI 綠燈、Vercel preview 以內建瀏覽器走完註冊→引導→帳戶流程並截圖。

## 實作備註（2026-10-23 完成）

- **Next 16 Cache Components**：讀取 cookie 的伺服器程式都放在 `<Suspense>` 內；`src/lib/supabase/server.ts` 先 `await connection()` 再建立 client，否則 supabase-js 檢查 session 時呼叫的 `Date.now()` 會被分段渲染視為同步 IO 錯誤（`partialPrefetching` 開啟時）。
- **TanStack Query 只在瀏覽器端執行**：`src/components/client-only.tsx` 用 `useSyncExternalStore` 讓伺服器與 hydration 階段先出骨架；頂欄的帳本名稱、使用者選單與各頁 view 都包在裡面。原因同上：`useQuery` 在伺服器 render 時會讀 `Date.now()`。
- **React Compiler 規則**：不能在 render 中把元件存進變數再寫成 JSX（`LedgerIcon` 改用 `createElement`）；不能在 effect 裡同步 setState（表單改成資料載入後才渲染、用 props 初始化 state）。
- **引導頁在獨立的 `(onboarding)` route group**，不走 `(app)` 的側欄外框，也避免 gate 互相導向。
- **本機測試帳號**：以 SQL 直接建立並標記信箱已確認，帳密記在 gitignored 的 `.env.local`（`DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`）。信箱寄送流程（確認信、重設密碼信）需等 Brevo／Supabase 設定完成後才能實測。
- **已驗證**：未登入導向、登入、引導頁寫入（改名、刪帳戶、期初餘額）、帳戶新增／排序／封存／編輯期初餘額、子類別新增、分頁切換、設定頁改名與起始日同步期初交易日期、登出、註冊表單驗證、忘記密碼頁；SQL 層另有 rollback 測試涵蓋 trigger、RPC、子類別限制與 RLS。

## 實作順序（同一個 PR，分多個 commit）

1. migration 與 SQL 測試
2. 註冊／登入／登出／忘記密碼頁面、Server Actions、`/auth/callback`、proxy 規則
3. `(app)` layout、導覽、使用者選單、`useLedger()`
4. `/onboarding`
5. `/accounts`（含期初餘額、排序、封存）
6. `/categories`（含子類別、排序、封存）
7. `/settings`、儀表板提示卡、瀏覽器驗證、文件更新
