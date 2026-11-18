# 里程碑 6：收尾 — 規格

討論日期：2026-11-18。完成定義：可以用 Google 登入；整本帳本能匯出成 JSON 並從備份還原；主要流程有 Playwright E2E；已知的安全警告都處理或記錄；README 寫到別人照著就能架起來。

## 已確認的決策

| 項目 | 決定 |
|---|---|
| E2E 環境 | **連正式資料庫，用專用測試帳號**（`.env.local` 的 `DEV_TEST_EMAIL`／`DEV_TEST_PASSWORD`）。測試建立的資料一律加 `[E2E]` 前綴，跑完自動刪除。因為會寫正式資料庫，**只在本機手動跑**（`npm run e2e`），不放進 GitHub CI |
| JSON 備份 | **匯出＋匯入還原**。設定頁一鍵下載整本帳本；上傳備份檔可還原，還原會**覆蓋目前帳本**，送出前要再確認一次 |
| Google 登入 | 同一個信箱先用 Email 註冊、後來用 Google 登入時，**合併成同一個帳號**（Supabase 預設：信箱已驗證就自動連結），看到同一本帳本 |
| 安全審查 | 四項都做：升級 Next.js 到修正版、修 Supabase 兩條警告、RLS 與函式權限自動測試（放進 CI）、防止 Supabase 免費方案自動暫停 |

## 安全審查（PR A）

### 升級 Next.js

- `next build` 提示目前的 16.4.2 有已知安全性漏洞。查 npm 上 16.x 的修正版，升 `next`（與 `eslint-config-next` 等同系列套件），先讀 `node_modules/next/dist/docs/` 的升級說明與棄用公告。
- 升完跑 lint／tsc／test／build；build 不應再出現安全性提示，以建置本身的結束碼確認。

### Supabase 安全警告

- `create_ledger_with_defaults` 是 `SECURITY DEFINER` 且登入者可以直接呼叫。前端沒有用到（帳本由註冊 trigger 建立），**收回 `authenticated` 的執行權限**；之後做多帳本時再改成 `security invoker` 加上限制後開放。
- 外洩密碼防護（Leaked password protection）：只有 Supabase Pro 方案以上才能開，本專案是免費方案，**決定記錄為已知風險、不升級**（見實作備註）。
- 改完重跑 Supabase 安全檢查（advisors），結果記進實作備註。

### RLS 與函式權限自動測試

- `supabase/tests/rls.sql`：在交易內建立兩個測試使用者與帳本，逐一驗證每張表（`ledgers`、`profiles`、`accounts`、`entries`、`entry_lines`、`budgets`、`goals`、`goal_deposits`）與每個 RPC：本人可讀寫；他人讀不到、改不了、刪不掉、也不能寫進別人的帳本；`anon` 什麼都拿不到。全部通過就 `raise exception 'ALL_OK'` 回滾（同里程碑 5 的做法），任何一項失敗就丟出具體訊息。
- CI 新增一個 job：用 Supabase CLI 啟動本機 Postgres（GitHub Actions 有 Docker）、套用 `supabase/migrations/`、執行 `rls.sql`，看到 `ALL_OK` 才算通過。不連正式資料庫。

### 防止自動暫停

- 新增 GitHub Actions 排程（每天一次，也可手動觸發）：用 publishable key 對 REST API 查一次 `ledgers`（RLS 下 anon 會拿到空陣列，但會碰到資料庫），讓專案保持活躍。
- URL 與 publishable key 放在 GitHub repository variables（publishable key 本來就公開在前端，不算機密）。設定由使用者同意後用 `gh` 寫入。

## Google 登入（PR B）

### 使用者要先做的設定（寫成 `docs/setup-google.md`）

1. Google Cloud Console 建 OAuth 用戶端（網頁應用程式），授權的重新導向 URI 填 `https://<專案>.supabase.co/auth/v1/callback`。
2. Supabase 後台 Authentication → Providers → Google：填用戶端 ID 與密鑰並啟用。
3. Supabase Authentication → URL Configuration：確認正式站網址與 `http://localhost:3000` 都在允許的重新導向清單裡。

### 畫面與流程

- 登入頁與註冊頁多一顆「使用 Google 登入」按鈕（分隔線「或」），呼叫 `signInWithOAuth({ provider: "google", redirectTo: <origin>/auth/callback?next=… })`；`/auth/callback` 沿用，交換 session 後照原本的規則導向（未完成引導 → `/onboarding`）。
- 第一次用 Google 登入的新使用者：`handle_new_user` 顯示名稱改成 `display_name → full_name → name → 信箱前段` 的順序，帳本照舊由 trigger 建立。
- 錯誤訊息轉繁中（使用者取消授權、provider 未啟用）。

## JSON 備份與還原（PR C）

### 匯出

- 設定頁新增「備份與還原」卡：「下載備份」產生 `帳本備份-YYYY-MM-DD.json`。
- 格式：`{ app: "financial", version: 1, exported_at, ledger, profile, accounts, entries, entry_lines, budgets, goals, goal_deposits }`；`ledger` 含名稱、封面、起始日、每月總支出上限；`profile` 含顯示名稱、標語、動畫開關。在瀏覽器端用 RLS 讀取，不經伺服器。

### 還原

- 上傳 JSON（上限 5 MB）→ 前端用 zod 驗證格式與版本、每筆交易借貸平衡、所有參照都找得到 → 顯示摘要（帳戶與類別數、交易筆數與日期範圍、目標數）→ 確認對話框（「會覆蓋目前帳本，無法復原；建議先下載目前的備份」）。
- RPC `restore_ledger(p_ledger uuid, p_data jsonb)`（`security invoker`、只授權 `authenticated`）：在**同一個交易**裡刪掉目前帳本的交易、分錄、預算、目標、存入與科目，再依備份重建。所有 id **重新產生並對應**（舊 id → 新 id），所以別人的備份或同一份備份還原兩次都不會撞主鍵；借貸平衡仍由既有的 constraint trigger 在 commit 時檢查，任何一步失敗整個回滾，帳本維持原樣。
- 還原完成後清掉前端所有查詢快取並導到今天這一頁。

## Playwright E2E（PR D）

- `playwright.config.ts`：先啟動 `next dev`，用 `.env.local` 的測試帳號在 `global-setup` 登入一次，存 `storageState` 給各測試共用。
- 情境：登入／登出與使用者選單；記一筆支出 → 今天這一頁與交易清單都看得到 → 編輯 → 刪除；本月頁「還能花」與改當月額度；報表六段期間切換、三張報表上方的圖；儲蓄目標（手動目標存入到達標、封存）；設定頁下載備份（檢查 JSON 內容）。
- 清理：`global-teardown` 用 supabase-js 以測試帳號登入，刪掉名稱或備註以 `[E2E]` 開頭的交易、目標、存入與預算覆寫；每個測試自己建、自己用，不依賴帳本既有資料。
- 不測註冊與寄信（會真的寄信）、不測 Google 登入（要真的 Google 帳號）、不測還原（會覆蓋測試帳本，由單元測試與 SQL 測試涵蓋）。
- **前提**：`DEV_TEST_EMAIL` 必須是專用測試帳號，不能是平常記帳用的帳號；`global-setup` 會檢查帳號名稱或信箱，對不上就拒絕執行。

## README（PR D 一起）

- 功能總覽（含截圖位置）、技術架構、本機開發（環境變數、`npm run dev`）、Supabase 設定（migration、Brevo 寄信、Google 登入連到對應的 setup 文件）、測試（`npm test`、`rls.sql`、`npm run e2e` 與注意事項）、部署（Vercel）、備份與還原說明、已知限制。

## PR 切分

| # | 分支 | 內容 | 驗收 |
|---|---|---|---|
| A | `m6-security` | Next.js 升級、收回 `create_ledger_with_defaults` 權限、`rls.sql` 與 CI job、保持喚醒排程 | build 沒有安全性提示；advisors 只剩外洩密碼防護（免費方案不能開，記為已知風險）；CI 的 RLS job 綠燈；排程手動觸發成功 |
| B | `m6-google` | Google 登入按鈕、`handle_new_user` 顯示名稱、`docs/setup-google.md` | 用 Google 登入新帳號走到引導頁；同信箱的 Email 帳號用 Google 登入看到同一本帳本 |
| C | `m6-backup` | 匯出、匯入驗證與摘要、`restore_ledger` RPC | 匯出 → 改幾筆 → 匯入後回到匯出時的狀態；壞檔被擋下且帳本不變 |
| D | `m6-e2e` | Playwright 設定與情境、清理、README 完整版 | `npm run e2e` 全部通過且跑完帳本沒有 `[E2E]` 資料 |

## 實作備註

### PR A 安全審查（2026-11-18 實作、已合併 #13）

- **Next.js 16.4.2 → 16.4.6**（`eslint-config-next` 同步）：修正 GHSA-mfr8-8qww-v76h、GHSA-vc7v-qv4w-wrv8（`use cache` 跨 root params 的快取資訊外洩，影響到 16.4.4；本專案沒有用 `use cache`／`unstable_cache`）。升級後 build 不再出現安全性提示，第一次就以結束碼 0 完成。
- **沒有一起做 `npm audit fix`**：試過會把 lockfile 裡各平台的 `@unrs/resolver-binding-*` 選用套件（含 CI 的 linux-x64-gnu）一起拿掉，可能讓 `npm ci` 壞掉，所以還原。剩下的 22 條都在開發工具（shadcn CLI、vitest／vite、typescript-eslint、eslint-config-next 帶的 glob 套件），不會進到網站；`npm audit` 建議的修法是降回舊大版本（vitest 3、shadcn 2、eslint-config-next 14），不採用，等上游更新。
- Migration `20261118001623_milestone_6_security.sql`：收回 `create_ledger_with_defaults` 的 `authenticated` 執行權限。之後 Supabase advisors 只剩「外洩密碼防護未開啟」。
- **已知風險：外洩密碼防護未開啟**。這個功能（比對 HaveIBeenPwned 外洩密碼庫）只有 Pro 方案以上才有，組織目前是免費方案；2026-11-18 與使用者討論後決定不為此升級，也暫不調高密碼強度規則（調了要同步改註冊頁的驗證與錯誤訊息）。影響：使用者仍可能用已外洩的常見密碼註冊。緩解：密碼至少 8 碼、Supabase 內建登入頻率限制；之後升級 Pro 時到 Authentication → Providers → Email 打開「Prevent use of leaked passwords」即可。
- **RLS 測試抓到一個缺口**：`budgets` 可以在自己的帳本建一列、卻掛在別人帳本的類別上（讀不到別人的資料，但參照錯亂）。Migration `20261118001914_milestone_6_budget_refs.sql` 補 `validate_budget_category` 觸發器（同一本帳本的費用類別才行）；套用前確認現有資料沒有違反。
- `supabase/tests/rls.sql`：兩位測試使用者，42 項檢查（本人讀得到；他人讀不到／改不了／刪不掉 8 張表與檢視；8 個報表統計函式拿不到數字；17 種寫進別人帳本或掛到別人科目、用別人 id 呼叫 RPC、呼叫不開放函式都被擋；anon 讀不到 9 張表、呼叫不了 13 個函式）。已在正式資料庫以回滾方式跑過，`ALL_OK`。
- CI 新增 `rls` job：`supabase db start` 起本機 Postgres 套 migrations，`psql` 跑 `rls.sql`，看到 `ALL_OK` 才通過。`supabase/config.toml` 補 `project_id = "financial"`（CLI 需要）。
- `.github/workflows/keepalive.yml`：每天 UTC 03:17 與手動觸發，用 publishable key 查一次 `ledgers`；本機以同一個查詢測過回傳 200。需要 repository variables `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`；排程只在合併到 main 後生效。2026-11-18 合併（#13）後手動觸發一次成功，CI 的 `rls` job 綠燈。

### PR B Google 登入（2026-11-18 實作、已合併 #14）

- 登入頁與註冊頁最上面加「使用 Google 登入」按鈕和「或」分隔線（`src/components/auth/google-sign-in.tsx`）。按鈕送出 server action `signInWithGoogle`：先查 Supabase 的 `/auth/v1/settings` 確認 Google 已啟用（沒開就顯示「Google 登入尚未啟用，請先用 Email 登入」，不會跳到 Supabase 的錯誤 JSON 頁），再用 `signInWithOAuth` 取得授權網址導過去；`prompt=select_account` 讓有多個 Google 帳號的人每次都能選。
- 回跳網址是 `/auth/callback?next=…&via=google`。`via=google` 讓 callback 出錯時導回 `/login?error=google_cancelled`（使用者在 Google 按取消）或 `google`（其他失敗），跟 Email 連結過期的訊息分開。
- **順手修掉一個舊問題**：`/auth/callback` 原本只要有 `x-forwarded-host` 就一律組 `https://` 網址，本機 `next dev`（http）會被導到打不開的 `https://localhost:3000`；改成看 `x-forwarded-proto`。正式站在 Vercel 上仍然是 https。
- Migration `20261118022526_milestone_6_google_display_name.sql`：`handle_new_user` 顯示名稱依序取 `display_name → full_name → name → 信箱前段`，最多 40 字（同設定頁限制）。已在正式資料庫用回滾交易模擬三個 Google 新使用者驗證：名稱取對、空白的 display_name 會往下找、過長截到 40 字、帳本照常建立。
- 同信箱合併靠 Supabase 的自動連結（不用寫程式）：信箱已確認的 Email 帳號用 Google 登入，會連到同一個使用者、看到同一本帳本。注意：若 Email 帳號**還沒確認**，Supabase 為防止搶註會移除那個未確認的密碼登入方式（寫在 `docs/setup-google.md`）。
- Google 後台與 Supabase 的設定步驟寫在 `docs/setup-google.md`。2026-11-18 實際設定：Google Cloud 專案 `financial-app-515103`，OAuth 用戶端「financial app Supabase」，同意畫面「我的帳本」（外部、測試中，測試使用者只有站長本人；要開放給別人需先在「品牌」補首頁與隱私權政策才能發布）。用戶端密鑰由使用者本人貼進 Supabase。
- **踩到的坑**：Supabase 原本的 Redirect URLs 只有不帶萬用字元的 `…/auth/callback`，比對不到帶參數的 `/auth/callback?next=…&via=google`。正式站因為跟 Site URL 同網域所以不受影響，但從 `localhost` 出發會被退回 Site URL（正式站首頁），看起來像「登入沒成功」。補上 `http://localhost:3000/**`、`https://financial-xicheng.vercel.app/**`、`https://financial-*-xicheng.vercel.app/**` 後正常。
- **驗收**：本機用站長的 Google 帳號登入，回到原本的封面與帳本；資料庫確認沒有新增使用者，原帳號的登入方式變成 `email` + `google`（Supabase 自動連結）。

### PR C 備份與還原（2026-11-18 實作、已合併 #15）

- 設定頁新增「備份與還原」卡（`src/app/(app)/settings/backup-card.tsx`）：「下載備份」產生 `帳本備份-YYYY-MM-DD.json`；「選擇備份檔…」→ 瀏覽器端驗證 → 顯示摘要（帳本、備份時間、帳戶與類別數、交易筆數與日期範圍、預算與目標）→「用這份備份還原…」→ 確認對話框（可先下載目前的備份）→ 還原成功後重置所有查詢並導到今天這一頁；失敗時顯示「還原失敗，帳本維持原樣」。
- 匯出（`src/lib/ledger/backup.ts`）在瀏覽器端用 RLS 讀取；PostgREST 一次最多 1000 列，交易與分錄分頁抓。每列去掉 `ledger_id`／`created_by`，分錄、預算、存入連 id 一起去掉（還原會重建）。
- 格式、驗證、摘要是純函式（`src/lib/ledger/backup-model.ts`，22 項單元測試）：zod 檢查欄位；app／版本；id 不重複；必須有「期初餘額」科目；上層類別、交易、分錄、預算（只能掛費用類別）、目標（只能綁資產帳戶）、存入的參照都要找得到；每筆交易至少兩行、每行只有借或貸、借貸相等（用分比對避免浮點誤差）。
- Migration `20261118144444_milestone_6_restore_ledger.sql`：`restore_ledger(p_ledger, p_data)`，`security invoker`、只授權 `authenticated`。再驗一次 app／版本／格式／id 重複／參照，接著刪掉目前帳本的存入、目標、預算、交易（分錄連帶）、子類別、科目，更新帳本設定，然後依序重建科目（先父後子）、交易、分錄、預算、目標、存入；舊 id → 新 id 用 `jsonb_object_agg(..., gen_random_uuid())` 一次對應好，整個流程是集合式 insert，不逐筆迴圈。借貸平衡交給既有的 deferred constraint trigger 在 commit 時檢查。個人資料（顯示名稱、標語、動畫開關）屬於帳號，匯出但不還原。
- `supabase/tests/restore.sql`（12 項，也放進 CI 的 `rls` job）：改動後還原回到備份狀態（以名稱比對科目、餘額、交易、預算、目標、存入、帳本設定）、id 重新產生、同一份還原兩次、不能還原到別人的帳本、借貸不平衡／參照不完整／版本不對都被擋下且帳本不變、另一位使用者還原同一份備份互不影響、anon 不能呼叫。已在正式資料庫以回滾方式跑過，`ALL_OK`。
- 本機畫面驗證：下載的檔案內容與資料庫筆數一致、沒有 `ledger_id`、每筆借貸平衡；上傳壞檔顯示「備份檔裡有借貸不平衡的交易（日期「備註」）」；上傳正常檔顯示摘要與確認對話框（按取消，沒有實際覆蓋正式帳本）。

### PR D E2E 與 README（2026-11-18 實作、已合併 #16）

- `@playwright/test` 1.65 與 Chromium headless shell；`npm run e2e`。`playwright.config.ts` 用 `@next/env` 讀 `.env.local`、自動起 `next dev`、`workers: 1`（共用同一個測試帳號）、`zh-TW`／`Asia/Taipei`。
- 專案結構：`setup` 專案（`e2e/global.setup.ts`）→ 各情境（`e2e/0*.spec.ts`）→ `teardown` 專案（`e2e/global.teardown.ts`）。setup 先檢查 `DEV_TEST_EMAIL` 網域必須是 `.test`（不是就拒絕執行）、清掉上次殘留、記下每月總支出上限與開始時間、透過畫面登入一次存 `storageState`；teardown 刪掉 `[E2E]` 開頭的交易／目標／存入與這次之後新增的預算、還原總支出上限，並確認帳本沒有 `[E2E]` 資料。
- 六個情境：記一筆（算式金額）→ 今天這一頁 → 交易清單 → 編輯 → 刪除；本月還能花跟著總支出上限變、類別當月額度；報表六種期間（URL `preset`）與三張圖（確認 Recharts 畫出 svg）；手動目標存入到達標（toast 與進度 100%）再封存；下載備份（檔名、欄位順序、沒有 `ledger_id`、每筆借貸平衡）；登入 → 使用者選單 → 登出（放最後，登出會讓 refresh token 失效）。
- **E2E 抓到一個真的 bug**：設定頁存帳本設定或個人資料後，「已儲存」的提示從來不會出現。原因是存完重抓資料，表單以資料當 `key` 重新掛載，TanStack Query 的 `mutate(..., { onSuccess })` 在元件卸載後不會呼叫。改用 `mutateAsync().then(...)`。
- 2026-11-18 本機跑兩次：第一次抓到上述 bug 與一個選擇器過寬；修正後 8 項（含 setup／teardown）全過，約 36 秒；之後查資料庫確認測試帳號回到原樣（15 筆交易、0 目標、0 預算、總支出上限 25000）。
- README 改寫成完整版：功能總覽（每個畫面的位置）、技術架構、本機開發與環境變數、Supabase 設定（migration、URL、Brevo、Google、測試帳號）、測試（Vitest、SQL、E2E 注意事項）、備份與還原、部署、已知限制。

## 不在此里程碑

多帳本切換、Email 提醒、匯入其他記帳 App 的資料、行動 App。
