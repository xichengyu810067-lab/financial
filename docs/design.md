# 設計系統：筆記本

設計稿：Claude Design 畫布「財報筆記本 里程碑 4 設計稿」（封面、翻書、今天這一頁、月章節頁、年度封底、報表、動畫分鏡）。本文件記錄落地到程式的規則，改外觀時以這裡為準。

## 概念

- **一本筆記本**：登入後先看到封面（`/cover`），點一下翻開，進到內頁。內頁的每一頁（今天、交易、報表…）都是一張米白紙放在暖灰桌面上。
- **桌面**：`--background`（暖灰）加細點（`.paper-dots`）；只有桌面用這個底。
- **內頁紙**：`.paper-page`：`--paper` 米白、每 28px 一條淡橫線、細微紙紋；桌機左側有一條虛線裝訂邊（`PaperPage` 元件）。
- **卡片**：純白 `--card`、18px 圓角、底下一條薄薄的紙緣陰影（`.shadow-paper`）。統計卡用上緣 3px 色線表達語意（收入綠、支出紅、主題色、墨色），不再貼紙膠帶。
- **主題色漸層**（預設 `#FF359A → #FF44FF`，左下到右上）只用三處：標誌字、主要按鈕、目前分頁。其餘地方用 `--accent-ink` 單色或 `--accent` 淡底。
- **手帳元素只留有語意的**：印章（`Stamp`）只用在「淨值」「平衡」「已記」；收據虛線列表（`ReceiptList`）用在交易清單；票根鋸齒邊只在記帳與明細面板底部。紙膠帶、便利貼、波浪底線、螢光筆標籤、打孔缺口都已移除。

## 色票（`src/app/globals.css`）

| 用途 | 淺色 | 深色 |
|---|---|---|
| 桌面 `--background` | `#EFE7DA` | `#1C171A` |
| 內頁紙 `--paper` | `#FBF6EC` | `#27202A` |
| 卡片 `--card` | `#FFFDF9` | `#2C242A` |
| 墨 `--foreground` | `#2B2420` | `#F4EAE2` |
| 次要字 `--muted-foreground` | `#6F6156` | `#B8A8A1` |
| 線 `--border` / `--line` | `#E6DCCB` | `#3F343B` |
| 收入 `--income` | `#1F8A5B` | `#7FD1A6` |
| 支出 `--expense` | `#D4552F` | `#FF9A7A` |
| 警示 `--warning` | `#D97706` | `#F5B14D` |

主題色以 `html[data-accent]` 切換，四組：`pink`（預設）、`sunset`、`mint`、`violet`，定義在 `src/lib/brand.ts` 的 `ACCENTS` 與 `globals.css`。每組提供 `--accent-from/to`、`--accent-ink`、`--accent-tint`、`--accent-shadow`、`--highlight-from/to`。漸層上的文字一律用 `--ink-on-accent`（深墨）。

## 封面

- `NotebookCover`（`src/components/journal/notebook-cover.tsx`）：顏色（`COVER_COLORS`，六色）+ 材質紋理（`.cover-linen` / `.cover-leather` / `.cover-kraft`）+ 書背 + 主題漸層鬆緊帶 + 頁緣 + 手寫標籤（帳本名稱、年份、小標語）。三種尺寸：`lg` 封面頁、`md` 設定頁預覽、`sm` 小圖。
- 顏色與材質存在 `ledgers.cover_color` / `cover_material`，設定頁「封面」卡點一下就存。
- 翻書：`.book-scene[data-opening=true] .book-cover` 繞左緣 `rotateY(-150deg)`，整本書 `book-zoom` 放大淡出，約 1 秒後導到 `/today`；`prefers-reduced-motion` 時不播，直接進入。

## 字體

- 內文：**Huninn**（jf open 粉圓，`@fontsource/huninn`），`font-sans`
- 標題、日期、問候語、標語、封面：**LXGW WenKai TC**（霞鶩文楷），`font-hand`
- 數字一律 `tabular-nums`（body 已全域設定 `tnum`）

## 工具類別

| 類別 | 用途 |
|---|---|
| `.paper-dots` | 桌面（暖灰 + 細點） |
| `.paper-page` | 內頁紙（米白 + 淡橫線 + 紙紋） |
| `.cover-linen` `.cover-leather` `.cover-kraft` | 封面材質紋理 |
| `.book-cover` / `.book-scene[data-opening]` | 翻書動畫 |
| `.bg-accent-gradient` | 主題漸層底 + 深墨字 |
| `.text-accent-gradient` | 漸層文字（標誌字） |
| `.font-hand` | 手寫感字體 |
| `.shadow-paper` | 紙緣陰影 |
| `.shadow-accent-press` | 主要按鈕的實體陰影 |
| `.receipt-edge` | 票根鋸齒邊（面板底部） |

## 元件

- 外框（`src/components/app-shell/`）：`TopNav` 頂部分頁（桌機）、`MobileTabBar` 底部四格（手機：今天、本月、交易、更多）、`AddEntryButton` 浮動記一筆、`ThemeToggle`、`UserMenu`（含「回到封面」）。分頁定義在 `nav.ts`。
- 紙與手帳（`src/components/journal/`）：`PaperPage`、`NotebookCover`、`Stamp`、`ReceiptList`、`Logo`。
- 基礎元件（`src/components/ui/`）：按鈕膠囊化、卡片 18px 圓角不裁切、Tabs 改成底線式（目前分頁粗體 + 主題色底線，內容區不帶卡片）、Dialog／Sheet 紙張底與暖色遮罩。
- 報表表格（`src/app/(app)/reports/report-table.tsx`）：區段標題粗體小字 + 細線、佔比欄有比例條、檢核列平衡時淡綠一行 + 小印章。

## 個人化

- **平台名稱**：改 `src/lib/brand.ts` 的 `BRAND_NAME`，標誌字、分頁標題、登入頁會一起換。
- **問候語**：依時段自動（早安／午安／晚安）+ 顯示名稱；**小標語**在設定頁填，存在 `profiles.slogan`，也印在封面上。
- **深淺色**：`next-themes`，右上角切換，設定頁可選跟隨系統。
- **主題色**：設定頁的貼紙，存在瀏覽器 `localStorage`（`financial:accent`），`layout.tsx` 的 inline script 在第一次繪製前套用避免閃爍。
- **封面**：設定頁的材質與顏色，存在帳本。

## 可及性

- 文字對比至少 4.5:1：主題色文字用 `--accent-ink`，次要字用 `#6F6156`／`#B8A8A1`。
- 收入與支出除了顏色也用 `+`／`−` 符號區分；警示除了顏色也有圖示與文字。
- 裝飾元素（印章、裝訂邊、紋理）都是 `aria-hidden`；封面是一個 `<button>`，鍵盤 Enter／空白鍵可翻開；減少動態時不播動畫。
