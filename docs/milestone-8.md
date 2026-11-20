# 里程碑 8：資安強化與架構整理 — 規格（草稿）

討論日期：2026-11-20。背景：使用者向財政部確認，**一般消費者不能申請電子發票 API，平台只能查看、不能匯出**。所以載具自動同步不做，新功能開發與里程碑 7 的實際驗收先暫停，這個里程碑只做資安與架構，不新增功能。

完成定義：已知的資安缺口都修掉或記成已知風險；資料庫對單一帳號的寫入量有上限；頁面出錯時看得到錯誤、可以重試；報表明細不會被 1000 列上限截斷；E2E 改在 CI 的本機 Supabase 上跑，不再寫正式資料庫。

## 審查結果摘要（2026-11-20，唯讀審查）

- **跨使用者讀寫**：沒有找到。12 張表都開了 RLS，`with check` 擋住把資料搬到別人帳本；三個 `SECURITY DEFINER` 函式都固定 `search_path` 且不開放呼叫；唯一的檢視 `account_balances` 是 `security_invoker`。
- **確認的問題**（依嚴重度）：

| # | 嚴重度 | 問題 | 位置 |
|---|---|---|---|
| 1 | 中 | 登入後的 `next` 開放式重導向：`/\evil.com` 會通過檢查，瀏覽器解析成 `https://evil.com/`（已用 Node 的 URL 解析驗證） | `src/lib/auth/actions.ts` `safeNext` |
| 2 | 中 | 沒有任何安全標頭（CSP、防嵌入、HSTS、Referrer-Policy、Permissions-Policy、nosniff），刪除、還原這類操作可能被點擊劫持 | `next.config.ts` |
| 3 | 中 | 單一帳號寫入量沒有上限：文字欄位不限長度、帳本可透過 REST 無限新增、`restore_ledger` 與拆分不限筆數；免費方案 500 MB 一旦被灌滿，全站變成唯讀 | migrations |
| 4 | 中 | 報表明細的 `useEntriesInRange` 沒有分頁，期間超過 1000 筆時明細與合計會悄悄少算 | `src/lib/ledger/reports.ts` |
| 5 | 低 | 註冊會告訴人「此信箱已註冊」，可以拿來試出別人有沒有帳號 | `actions.ts`、`errors.ts` |
| 6 | 低 | 登出時沒有清掉前端快取，同一台瀏覽器換人登入的 30 秒內，會短暫看到上一位的名稱與帳本名稱 | `providers.tsx` |
| 7 | 低 | `/api/merchants` 查統編沒有快取也沒有頻率限制，可能被拿來大量打經濟部 API | `src/app/api/merchants/route.ts` |
| 8 | 低 | 確認待確認匣時，拆分金額在四捨五入前比對（50.005＋49.995 會通過，存進去變 100.01） | `confirm_inbox_item` |
| 9 | 低 | `net_worth_by_month` 不限日期區間，可以被拿來空耗 CPU | migrations |
| 10 | 低 | CI 沒有設 `permissions`、`supabase/setup-cli` 用 `latest`、`shadcn` 放在正式相依（害 `npm audit --omit=dev` 有 6 條） | `.github/workflows`、`package.json` |
| 11 | 資訊 | 同一使用者能弄亂自己的帳：REST 可改 `inbox_items.status` 讓同張發票再確認一次、刪系統科目、偽造 `entries.created_by` | migrations |
| 12 | 資訊 | anon 仍保有預設的資料表權限（RLS 擋住資料，但結構看得到） | migrations |

- **要到 Supabase 後台確認的設定**（repo 看不到正式值）：Secure password change（改密碼要先重新驗證）、伺服器端密碼最短長度（預設 6，前端是 8）、Email 寄送的 CAPTCHA。
- **架構**：tsc、lint、172 項單元測試、build 都通過。沒有 `error.tsx`，查詢失敗時畫面會一直停在載入骨架；unwrap 輔助函式複製了 5 份，query key 分散在 7 個檔案，寫入後的快取失效規則也分散；每一頁都要等 `useLedger()` 才開始查（今天這一頁約 15 個請求，其中 3 次完整的資產負債表只為了拿 3 個淨資產數字）；發票匯入每家店各打一次 RPC；E2E 寫正式資料庫、只能手動跑。
- **保留的好設計**：純函式的 `*-model.ts` 都有測試、SQL 是規則的唯一來源、SQL 測試在 CI 跑、重的套件（zxing、jsbarcode、recharts）都是動態載入。

## 建議的 PR 切分（待確認）

| # | 分支 | 內容 | 驗收 |
|---|---|---|---|
| A | `m8-app-security` | 修開放式重導向（改成用 URL 解析、比對 origin，加單元測試）；安全標頭（CSP 用 hash，因為 nonce 跟 `cacheComponents` 不相容；`camera=(self)` 給掃發票用；`wasm-unsafe-eval` 給 zxing 用）；註冊不再透露信箱已存在；登出清快取；查統編加快取與頻率限制；對外 fetch 加逾時；`SITE_URL` 取代信任 `x-forwarded-host`；CI 加 `permissions`、固定 CLI 版本；`shadcn` 移到 devDependencies | 重導向測試全擋；正式站標頭檢查通過，掃發票、Google 登入、圖表都正常；`npm audit --omit=dev` 0 條 |
| B | `m8-db-limits` | 文字與 jsonb 欄位加長度上限（套用前先查正式資料有沒有超過）；帳本 policy 拆開，不能從 REST 新增帳本；`restore_ledger`／拆分／固定支出加筆數上限；拆分金額限兩位小數；報表日期區間加上限；`inbox_items.status`、`entry_ids` 只能經由 RPC 改；系統科目不能刪；`created_by` 唯讀；收回 anon 的預設權限。`rls.sql` 補上 `with check`、更新路徑、anon 寫入的測試，並加一個「目錄檢查」：之後新表沒開 RLS、函式沒固定 `search_path` 或開放給 anon，CI 就會失敗 | SQL 測試全過；advisors 沒有新警告；正式資料不受影響 |
| C | `m8-data-layer` | 統一 `keys.ts`（query key）與 `db.ts`（unwrap、分頁抓取、數字轉換）；報表明細改成分頁或用 RPC 依科目查；寫入後要刷新哪些查詢整理成一張表（順便修：刪帳戶沒刷新待確認匣、還原後固定支出當天不會重產）；`error.tsx`、`global-error.tsx`、共用的錯誤與重試元件；`instrumentation.ts` 把伺服器錯誤記到 Vercel 日誌 | 刻意讓查詢失敗會看到錯誤與重試；超過 1000 筆的期間明細合計正確 |
| D | `m8-perf` | 伺服器端先把帳本與個人資料放進快取，省掉每頁等 `useLedger()`；`net_worth_at` 一次算多個日期；`add_inbox_invoices` 一次處理去重、分類建議、寫入（掃描與匯入共用，匯入變成全有或全無） | 今天這一頁請求數明顯減少；匯入、掃描的 E2E 照常通過 |
| E | `m8-ci-e2e` | `supabase/seed.sql` 建測試使用者與帳本；E2E 改在 CI 的本機 Supabase 跑、擋 PR；CI 比對 `supabase gen types` 與提交的型別檔；提交 schema 快照，看得到每個函式目前的定義 | PR 上 E2E 綠燈；正式資料庫不再被測試寫入 |

建議順序：A → B → C → E → D。A、B 是資安，先做；C 修掉真的 bug；E 讓後面的改動有 E2E 保護；D 是效能，最後做。

## 待使用者決定

1. PR 切分與順序照上表？
2. Supabase 後台三項設定（Secure password change、最短密碼 8 碼、CAPTCHA）要開嗎？CAPTCHA 要另外申請 hCaptcha 或 Cloudflare Turnstile 的金鑰，前端也要加元件。
3. 錯誤監控：只用 Vercel 日誌（免費、不用新帳號），還是接 Sentry（要註冊、錯誤資料會送到第三方）？
4. E2E 改到 CI 之後，還要保留本機連正式資料庫跑的選項嗎？

## 不在此里程碑

新功能（含雲端發票替代方案：網頁複製貼上匯入、信用卡對帳單匯入、截圖 AI 讀取）、里程碑 7 的實際發票驗收、多帳本、MFA。

## 實作備註

### PR A 應用程式資安（2026-11-20 實作、已合併 #20）

- **開放式重導向**：新增 `src/lib/auth/safe-next.ts` 的 `sanitizeNext`（純函式）：拒絕反斜線與控制字元、用 URL 解析後確認來源不變、限長 2048。登入、Google 登入與 `/auth/callback` 都改用它；原本的 `safeNext` 移除。17 項單元測試（`/\evil.com`、`/\t/evil.com`、`//`、`javascript:`、百分比編碼等）；E2E 用 `/login?next=%2F%5Cevil.example` 登入，確認回到 `/cover`。
- **安全標頭**（`next.config.ts` 的 `headers()`，全站）：CSP、`X-Frame-Options: DENY`、`nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`（相機只給自己）、`Cross-Origin-Opener-Policy: same-origin`、正式環境加 HSTS；關掉 `X-Powered-By`。
  - CSP 的 `script-src` 仍有 `'unsafe-inline'`：開了 `cacheComponents`／`partialPrefetching`，靜態外殼沒辦法每次請求換 nonce（Next 文件明載與 PPR 不相容），RSC 的 inline script 內容會變也不能用 hash。這版 CSP 擋的是點擊劫持、資料送到陌生網域（`connect-src` 只有自己與 Supabase）、外部 script、`<base>` 竄改與表單外送。**記為已知限制**：如果哪天出現 XSS，CSP 擋不住 inline script。
  - `'wasm-unsafe-eval'` 給 zxing；開發模式多 `'unsafe-eval'`；Vercel 預覽站放行 `vercel.live`（意見回饋工具列）。
  - `bluetooth` 會讓 Chrome 在主控台警告「不認得的功能」，所以拿掉。
- **註冊不再透露信箱是否已註冊**：重複註冊跟新註冊顯示同一個「確認信已寄出」畫面，畫面上提醒「之前註冊過的請直接登入或用忘記密碼」。
- **登出清快取**：`signOut` server action 只清 session；新的 `useSignOut` 接著 `queryClient.clear()` 並整頁導到 `/login`（連同模組層級狀態一起重置）。使用者選單與設定頁都改用它。
- **查統編**（`/api/merchants`）：同統編的結果用 `"use cache"` + `cacheLife("weeks")` 快取（公開資料，不分使用者；對方出錯或逾時會丟例外，不會把暫時失敗快取起來）；每位使用者每分鐘 30 次（`src/lib/rate-limit.ts`，記憶體內、每個執行個體各自計數，是減速帶不是精確配額；3 項單元測試）；回應加 `Cache-Control: private, no-store`；店名截到 100 字。
- **對外請求逾時**：Google 啟用檢查 `/auth/v1/settings` 加 5 秒逾時。
- **沒有做 `SITE_URL`**：Vercel 上 `x-forwarded-host` 由平台設定、使用者改不了，信件裡的回跳網址又受 Supabase 的 Redirect URLs 清單限制；只有自架時才需要，記在這裡。
- **CI**：兩個 workflow 都加 `permissions: contents: read`；actions 固定到 commit SHA（註解標版本）；Supabase CLI 從 `latest` 改成固定 `3.2.0`。
- **`shadcn` 移到 devDependencies**（只有 CLI 與 `globals.css` 的 `@import`，建置時才用到）。重裝時順帶升到 4.23.0，不再相依 express／hono；`npm audit --omit=dev` 從 6 條變 0 條。lockfile 裡 23 個各平台的 `@unrs/resolver-binding-*` 都還在（里程碑 6 踩過的坑）。
- **驗證**：lint、tsc、單元測試 192 項、build 都通過；E2E 全套 15 項本機通過（新增「安全標頭」一項，登出情境加上重導向檢查；掃發票情境確認 zxing 在 CSP 下正常），跑完測試帳號回到原樣。正式建置在本機開 `/today`、`/reports`、`/scan`，主控台沒有 CSP 違規，資料正常從 Supabase 載入。
