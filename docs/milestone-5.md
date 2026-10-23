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

### 月章節頁「本月預算」區塊

- 頂部一列：總預算（設定頁的每月總支出上限）、本月已花、剩餘、每天可花（剩餘 ÷ 剩餘天數；過去的月份不顯示每天可花）。沒設總預算時顯示「到設定頁填每月總支出上限」。
- 類別進度列沿用（進度條、黑色標記、已超過／習慣性超支），金額改成可點：點了出現小輸入框改「這個月」的額度，存 `budgets`（upsert），清空就刪掉覆寫；有覆寫的列標示「本月」徽章與原基準線。
- 子類別有自己的基準線時照里程碑 4 的規則另外評估，覆寫也以子類別為單位。

### 今天這一頁「這個月還能花」卡

- 只在今天顯示（翻到過去的日子不顯示）；內容：剩餘金額、每天可花、進度條（本月已花 ÷ 總預算）；超過時紅色。
- 沒設總預算就不顯示這張卡。

### 設定頁

- 「帳本」卡多一個「每月總支出上限」欄位（`ledgers.monthly_spending_limit`，可留空）。

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
| A | `m5-budgets` | 總支出上限、當月覆寫、`category_spending_stats` 改版、月章節頁預算區塊、今天這一頁「這個月還能花」卡 | 改某類別當月額度後進度與警示立即改用新額度；設總預算後兩頁看到剩餘與每天可花 |
| B | `m5-goals` | 目標與存入的資料表、進度函式、今天這一頁目標卡、全部目標面板、封面一行、達標回饋 | 新增綁帳戶目標後轉帳進去進度上升；手動目標按存入進度上升；達到目標蓋章且動畫加強；封面顯示進度 |

## 驗收

- Vitest：基準線優先順序、每天可花、目標進度／預測／達標、首頁顯示哪一個目標。
- SQL rollback 測試：當月覆寫影響 `category_spending_stats`、`goal_progress` 兩種目標、RLS。
- 瀏覽器：上述 PR 驗收項目；lint／tsc／build（以建置本身的結束碼確認）。

## 不在此里程碑

目標之間自動分配存款、預算的年度檢視、Email 提醒（里程碑 6 再議）。
