# 里程碑 5：預算進度與儲蓄目標 — 規格

討論日期：2026-10-24。完成定義：月章節頁看得到每個類別與整月的預算進度、可以直接改當月額度；今天這一頁與封面看得到儲蓄目標的進度與預測；達標那天有回饋。

## 已確認的決策

| 項目 | 決定 |
|---|---|
| 預算進度位置 | 併入月章節頁：「離基準線還有多遠」擴充成「本月預算」區塊，不另開分頁 |
| 月別覆寫 | 在進度列上點金額直接改「這個月」的額度，存進 `budgets` 表；類別的基準線不動。那個月的警示改用這個額度 |
| 總預算 | 有「每月總支出上限」（設定頁填）；月章節頁顯示整月剩餘，今天這一頁多一張「這個月還能花」卡，每天可花 = 剩餘 ÷ 剩餘天數 |
| 警示規則 | 沿用里程碑 4：照速度會超過 30% 就提前提醒；基準線的優先順序改成「當月覆寫 → 類別基準線 → 前三個月平均」 |
| 儲蓄目標的進度 | 兩種都可以：綁一個帳戶（進度 = 該帳戶目前餘額）或手動記存入（進度 = 存入合計） |
| 目標顯示位置 | 今天這一頁一張目標卡；封面標籤下方一行小字（例如「日本旅行 62%」）。管理（新增、編輯、手動存入、封存）在目標卡的「全部目標」側邊面板 |
| 達標與預測 | 照最近三個月的存入速度預測達標月份，有目標日就比對趕不趕得上；達標那天蓋「達標」章、撲滿動畫加強 |
| 目標數量 | 多個；今天這一頁只顯示「最接近達標」的一個（都未達標時取進度最高者；有目標日的優先取最快到期） |

## 預算

### 基準線的優先順序

1. `budgets`（該月覆寫，`month` = 當月 1 日）
2. `accounts.monthly_budget`（類別基準線）
3. 前三個完整月的平均（沒填時）

`category_spending_stats` 多回傳 `month_budget`（該月覆寫），`alerts.ts` 與 `chart-model.ts` 的 `baselineRows` 改用 `month_budget ?? monthly_budget`。

### 月章節頁「本月預算」區塊（PR A 的版本，驗收不通過，已被下方「重新規劃」取代）

- 頂部一列：總預算（設定頁的每月總支出上限）、本月已花、剩餘、每天可花（剩餘 ÷ 剩餘天數；過去的月份不顯示每天可花）。沒設總預算時顯示「到設定頁填每月總支出上限」。
- 類別進度列沿用（進度條、黑色標記、已超過／習慣性超支），金額改成可點：點了出現小輸入框改「這個月」的額度，存 `budgets`（upsert），清空就刪掉覆寫；有覆寫的列標示「本月」徽章與原基準線。
- 子類別有自己的基準線時照里程碑 4 的規則另外評估，覆寫也以子類別為單位。

### 今天這一頁「這個月還能花」卡

- 只在今天顯示（翻到過去的日子不顯示）；內容：剩餘金額、每天可花、進度條（本月已花 ÷ 總預算）；超過時紅色。
- 沒設總預算就不顯示這張卡。

### 設定頁

- 「帳本」卡多一個「每月總支出上限」欄位（`ledgers.monthly_spending_limit`，可留空）。

## 重新規劃：本月頁與報表（2026-10-24）

PR A 合併後在正式站驗收**不通過**：本月頁太擁擠（四個數字、每日長條、環圈、預算區塊疊在一起），使用者想第一眼就知道「這個月還有多少錢能花」；月報與年報在報表頁已經有了，不必在本月頁再顯示一次。重新討論後的決定：

| 項目 | 決定 |
|---|---|
| 本月頁的主角 | 一個大數字「這個月還能花」（剩餘金額），底下每天可花、剩幾天、進度列（黑色標記 = 今天應該在的進度）、已花／總預算 |
| 收入／支出／結餘三個數字 | 本月頁不顯示；報表頁的損益表有 |
| 類別清單 | **版型 B**：只列「要注意的」類別（已超過、照速度會超過、習慣性超支），每個附一句建議；其餘收合成一列「其他 n 類都在範圍內」，點開才展開。沒有要注意的就寫「這個月每一類都在範圍內」。金額仍可點改當月額度 |
| 每日長條與類別環圈 | 從本月頁移到報表頁，每張報表上方放對應的圖 |
| 報表期間 | 分段按鈕改成 日／週／月／季／年／自訂 六段；週 = 週一到週日 |
| 年度封底頁 `/year` | 取消；年報在報表頁選「年」 |
| 今天這一頁的「這個月還能花」小卡 | 保留 |

設計稿：Design 畫布「本月頁類別清單 三種版型」（版型 A 清單式、B 只列要注意的、C 卡片格、報表頁），使用者選 B。

### 本月頁（版型 B）

- 頁首沿用（年・第 n 章、月份、前後月按鈕）；「年度總覽」按鈕拿掉，頁尾連到該月的報表（`/reports?tab=income&preset=month&from=…&to=…`）。
- **還能花**區塊：有設總上限 → 大字 = 總上限 − 本月支出（負數紅色「已超過」），每天可花 = max(0, 剩餘) ÷ 剩餘天數（過去的月份不顯示每天可花），進度列與黑色標記，已花／總預算一行，連到設定頁改總預算。沒設總上限 → 大字改成「本月已花」，一行提示到設定頁填上限。
- **要注意的 n 類**：以 `baselineRows` 為底，加上該月的紅色（速度）與橙色（習慣）警示（`evaluateSpendingAlerts`，不帶當天交易）。列入條件：已超過（level over）、有紅色警示、有橙色警示。每列：圖示、名稱、徽章（已超過 $X／快超過・剩 $Y／習慣性超支）、進度列、一句建議（超過：已花多少、多了多少、剩幾天先別買；其他：警示的句子），金額「已花 / 額度」可點改當月額度（沿用 PR A 的輸入框與 `useUpsertMonthBudget`）。
- **其他 n 類都在範圍內**：一列可展開的摘要（各類別名稱與已花、合計還剩多少）；展開後每列是精簡版（圖示、名稱、「本月」徽章、可點金額、進度列）。
- 點類別名稱仍開右側明細面板。
- 純函式 `splitWatchRows(rows, alerts)` 決定哪些列要注意、每列的剩餘與對應警示（Vitest）。

### 報表頁

- `PeriodPreset` 加 `day`、`week`；`periodContaining("week", d)` = 含 d 的週一到週日；`shiftPeriod` 日 ±1 天、週 ±7 天；`periodLabel` 日 = 「2026 年 10 月 24 日（週六）」、週 = 「2026/10/19 – 10/25」；網址參數接受 `preset=day|week`。
- 每張報表的最上方放圖（下面才是三個數字與表格），圖表元件搬到 `src/components/charts/`：
  - 損益表：日／週／月／自訂（≤ 62 天）用每天收支長條（`DailyBars`，點一根開那天的明細），季／年／長自訂用每月雙長條（`MonthlyBars`，點一個月把報表期間切到那個月）；右側類別環圈（`CategoryDonut`，點一片開類別明細）。選「日」只有環圈。
  - 資產負債表：淨值走勢 `NetWorthArea`，截至期末往前 12 個月底（`net_worth_by_month`）。
  - 現金流量表：營業／投資／融資三組流入（往上）流出（往下）長條 `ActivityBars`，附表格版。
- 年度檢視原本的「月度明細」表拿掉（每月長條的「用表格看」就是同一份數字）。

### 移除年度封底

- 刪除 `src/app/(app)/year/*`（圖表元件搬走），`proxy.ts` 受保護路徑拿掉 `/year`，月章節頁的兩個年度連結改成報表連結。

## 儲蓄目標

### 資料

- `goals` 既有欄位：`name`、`target_amount`、`target_date`（可空）、`account_id`（可空 = 手動）、`note`；新增 `is_archived boolean`、`achieved_at date`（達標日，第一次達到就寫）、`sort_order`。
- 新表 `goal_deposits`：`id`、`ledger_id`、`goal_id`、`amount`（> 0）、`deposit_date`、`note`、`created_at`；RLS 同其他表（帳本擁有者）。手動目標的進度 = 存入合計；綁帳戶的目標也可以手動存入嗎？不行，二選一（綁了帳戶就隱藏「存入」按鈕）。
- 進度計算函式 `goal_progress(p_ledger uuid, p_as_of date)`：每個目標回傳 `saved`（綁帳戶 = 帳戶截至當日餘額；手動 = 存入合計）、`saved_90d`（最近 90 天的增加：綁帳戶 = 餘額差；手動 = 存入合計）。預測與達標判斷在前端純函式（Vitest）。

### 預測與達標

- 每月速度 = `saved_90d ÷ 3`；剩餘 = 目標 − 已存；速度 > 0 時預估達標月份 = 今天 + ceil(剩餘 ÷ 每月速度) 個月；速度 = 0 顯示「最近三個月沒有存入」。
- 有目標日：預估月份 ≤ 目標月份 → 「趕得上」；否則「照這速度會晚 n 個月，每月要存 X 才趕得上」。
- 已存 ≥ 目標 → 達標：寫 `achieved_at`（第一次），卡片蓋「達標」章；當天若是因為轉帳或存入而達標，記帳回饋動畫改播加強版撲滿（更多硬幣 + 「達標」章）。

### 畫面

- **今天這一頁目標卡**：目標名稱、已存／目標、進度條、預測句或達標章、「存入」按鈕（手動目標）與「全部目標」連結。沒有目標時顯示「設一個儲蓄目標」的空狀態。
- **全部目標面板**（右側滑出，同明細面板樣式）：列出未封存目標（進度、預測）、新增／編輯對話框（名稱、金額、目標日、綁帳戶或手動）、手動存入對話框（金額、日期、備註）、封存；已達標的放最後並標示。
- **封面**：標籤下方一行小字「{名稱} {百分比}」，沒有目標就不顯示。

## 資料庫變更（新 migration）

- `ledgers.monthly_spending_limit numeric(14,2) null check (>= 0)`
- `goals`：`is_archived boolean not null default false`、`achieved_at date null`、`sort_order integer not null default 0`
- `goal_deposits` 表 + RLS + index
- `category_spending_stats` 改版：多回傳 `month_budget`
- `goal_progress(p_ledger, p_as_of)` 函式
- 全部 `security invoker`、`set search_path = ''`，只授權 `authenticated`

## 前端

- `src/lib/ledger/budgets.ts`：`useMonthBudgets`、`useUpsertMonthBudget`（寫入後 invalidate reports）；`baselineRows` 與 `alerts.ts` 改讀 `month_budget ?? monthly_budget`。
- `src/lib/ledger/goals.ts`：`useGoals`、`useGoalProgress`、`useSaveGoal`、`useAddDeposit`、`useArchiveGoal`；`goal-model.ts` 純函式：進度、預測、達標、首頁要顯示哪一個（Vitest）。
- `src/app/(app)/months/budget-section.tsx`（取代 `baseline-progress.tsx`）、`src/app/(app)/days/budget-card.tsx`、`goal-card.tsx`、`src/components/goals/goals-sheet.tsx`、`goal-dialog.tsx`、`deposit-dialog.tsx`；封面 `NotebookCover` 多一行目標進度。
- 記帳回饋：`feedback.ts` 多一種 `achieved`（加強版撲滿），由轉帳到綁定帳戶或手動存入觸發。

## PR 切分

| # | 分支 | 內容 | 驗收 |
|---|---|---|---|
| A | `m5-budgets` | 總支出上限、當月覆寫、`category_spending_stats` 改版、月章節頁預算區塊、今天這一頁「這個月還能花」卡 | 改某類別當月額度後進度與警示立即改用新額度；設總預算後兩頁看到剩餘與每天可花（已合併；本月頁排版驗收不通過，由 A2 重做） |
| A2 | `m5-month-layout` | 本月頁重排（還能花大字＋版型 B 類別清單）、報表期間加日／週、每張報表上方放圖、移除年度封底 | 本月頁第一眼是「還能花」，只有要注意的類別展開；報表六段期間切換正確、三張表上方各有對應的圖、`/year` 不存在（2026-11-18 預覽站驗收通過，已合併） |
| B | `m5-goals` | 目標與存入的資料表、進度函式、今天這一頁目標卡、全部目標面板、封面一行、達標回饋 | 新增綁帳戶目標後轉帳進去進度上升；手動目標按存入進度上升；達到目標蓋章且動畫加強；封面顯示進度 |

## 驗收

- Vitest：基準線優先順序、每天可花、目標進度／預測／達標、首頁顯示哪一個目標。
- SQL rollback 測試：當月覆寫影響 `category_spending_stats`、`goal_progress` 兩種目標、RLS。
- 瀏覽器：上述 PR 驗收項目；lint／tsc／build（以建置本身的結束碼確認）。

## 實作備註

### PR A 預算（2026-10-24 完成）

- Migration `20261023162054_milestone_5_budgets.sql`：`ledgers.monthly_spending_limit`（≥ 0）；`category_spending_stats` 回傳欄位改變所以先 drop 再 create，多回傳 `month_budget`（`budgets` 表該月的覆寫）。
- 基準線優先順序集中在 `alerts.ts` 的 `effectiveBudget()`（當月覆寫 → 類別基準線），`paceAlert`／`habitAlert`／`baselineRows`／子類別候選都改用它；沒有就退回前三個月平均。`feedback.ts` 新類別的假統計列補 `month_budget: null`。
- `budgets.ts` 的 `useUpsertMonthBudget`：金額 null 就刪掉該月列，否則 upsert（`ledger_id,category_id,month` 唯一鍵）；寫入後 invalidate 報表前綴。
- 月章節頁的「離基準線還有多遠」改成 `BudgetSection`（`budget-section.tsx`，舊的 `baseline-progress.tsx` 刪除）：上方總預算列（沒設就提示到設定頁填），每列金額可點改當月額度，有覆寫時顯示「本月」徽章（滑過看原基準線）。
- 今天這一頁 `BudgetCard`：只在今天且有設總上限時顯示，放在淨值卡下方；每天可花 = max(0, 剩餘) ÷ 剩餘天數。
- 設定頁「帳本」卡多「每月總支出上限」欄位，留空清除。
- **已驗證（本機，測試帳本）**：設定頁填 25,000 後，今天這一頁出現「這個月還能花 $19,665，每天可花 $2,809，剩 7 天」，月章節頁總預算列一致；把購物當月額度改成 2,500 → 列變成「本月」徽章與 $3,900 / $2,500 已超過，今天這一頁的警示改寫「比基準線 $2,500 高 60%」；清空後回到類別基準線 $3,000。lint／tsc／test（64）／build（以建置本身結束碼確認）；SQL 情境測試：覆寫只影響該月、月中日期與負數上限被擋、他人看不到。

### PR A2 本月頁重排與報表融合（2026-10-24 實作，2026-11-18 合併）

- 本月頁 `month-view.tsx` 重寫：`SpendingHero`（`spending-hero.tsx`）大字「這個月還能花」＋每天可花＋進度列；`CategoryWatch`（`category-watch.tsx`，取代 `budget-section.tsx`）只展開要注意的類別、其餘收合；四個數字、每日長條、環圈都拿掉。`chart-model.ts` 新增 `splitWatchRows` / `watchReason`（Vitest）。
- 報表：`period.ts` 加 `day` / `week`（`dayPeriod`、`weekPeriod`，週一到週日），`periodLabel`、`shiftPeriod`、`periodFromParams` 跟著支援；`PeriodPicker` 六段。圖表元件搬到 `src/components/charts/`（`daily-bars`、`category-donut`、`monthly-bars`、`net-worth-area`，新增 `activity-bars` 與 `chart-figure`）；損益表上方每天／每月收支長條＋環圈（超過 62 天改每月），資產負債表上方淨值走勢（截至期末往前 12 個月），現金流量表上方三活動流入流出；年的「月度明細」表拿掉。`useDailySummary` 多一個 `enabled` 參數。
- 移除 `/year`（`proxy.ts` 一併拿掉）；`/budgets` 舊佔位頁改成導向 `/month`。
- 順手修一個既有錯誤：`/months/[month]` 的 `generateMetadata` 從標了 `"use client"` 的 `entries.ts` 引入 `isValidMonth`，過去月份的網址會伺服器錯誤（本機重現、正式站也會）；月份工具搬到 `src/lib/ledger/month.ts`，`entries.ts` 保留轉出。
- **已驗證（本機，測試帳本）**：本月頁大字 $19,665、每天可花 $2,809、剩 7 天；要注意的 1 類「購物 已超過 $900」附建議句；「其他 2 類都在範圍內」點開展開娛樂與飲食；把購物當月額度改成 2,500 → 徽章變「已超過 $1,400」、出現「本月」徽章，清空後回到 $3,000；`/months/2026-09` 顯示「這個月剩下 $20,000」。報表：週 = 「2026/10/19 – 10/25」七根長條；日只有環圈；年是每月長條且沒有月度明細；資產負債表上方 12 個月淨值（11 月 $0 → 10 月 $99,965，與表一致）；現金流量表上方三活動長條；`/year` 404。lint／tsc／test（69）／build（以建置本身結束碼確認）通過。
- 另外發現但**沒有在這個 PR 修**：點右上角使用者選單會整頁掛掉（`DropdownMenuLabel` 用了 Base UI 的 `Menu.GroupLabel`，必須包在 `Menu.Group` 裡），是既有問題。2026-11-18 於 `fix-user-menu` 修正。

## 不在此里程碑

目標之間自動分配存款、預算的年度檢視、Email 提醒（里程碑 6 再議）。
