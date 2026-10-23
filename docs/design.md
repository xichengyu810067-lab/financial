# 設計系統：手帳・漸層

設計稿：Claude Design 畫布「財報記帳平台 UI 重新設計」（五個畫面）。本文件記錄落地到程式的規則，改外觀時以這裡為準。

## 概念

- **紙**：米白點格紙底（`.paper-dots`），卡片是略白的紙張，底下一條薄薄的紙緣陰影（`.shadow-paper`）。
- **墨**：暖色深墨字，次要文字用暖灰，線條用米色虛線。
- **主題色**：一道左下到右上的漸層（預設 `#FF359A → #FF44FF`），只用在標誌字、紙膠帶、主要按鈕、索引標籤、進度條與重點；大面積留白讓數字好讀。
- **手帳元素**：筆記本索引標籤（側欄）、紙膠帶、便利貼、螢光筆標籤、印章、收據打孔與虛線、票根鋸齒邊。

## 色票（`src/app/globals.css`）

| 用途 | 淺色 | 深色 |
|---|---|---|
| 紙底 `--background` | `#FBF5EC` | `#221B1F` |
| 卡片 `--card` | `#FFFDF9` | `#2C242A` |
| 墨 `--foreground` | `#2B2420` | `#F4EAE2` |
| 次要字 `--muted-foreground` | `#6F6156` | `#B8A8A1` |
| 線 `--border` / `--line` | `#EADFD0` | `#3F343B` |
| 收入 `--income` | `#2F7D5B` | `#7FD1A6` |
| 支出 `--expense` | `#B93E22` | `#FF9A7A` |
| 便利貼 `--sticky` | `#FFF1A8` | 同 |

主題色以 `html[data-accent]` 切換，四組：`pink`（預設）、`sunset`、`mint`、`violet`，定義在 `src/lib/brand.ts` 的 `ACCENTS` 與 `globals.css`。每組提供：

- `--accent-from` / `--accent-to`：漸層兩端
- `--accent-ink`：能放在紙底上當文字的深色版（淺色模式）／亮色版（深色模式）；`--primary` 指向它
- `--accent-tint`：淡底（標籤、hover）
- `--accent-shadow`：按鈕「壓下去」的陰影色
- `--highlight-from/to`：螢光筆標籤底色

漸層上的文字一律用 `--ink-on-accent`（深墨），不用白字，對比才夠。

## 字體

- 內文：**Huninn**（jf open 粉圓，`@fontsource/huninn`），`font-sans`
- 標題、日期、問候語、標語：**LXGW WenKai TC**（霞鶩文楷），`font-hand`
- 數字一律 `tabular-nums`（body 已全域設定 `tnum`）

兩個字型都以 unicode-range 分檔，瀏覽器只下載用到的字。

## 工具類別

| 類別 | 用途 |
|---|---|
| `.paper-dots` | 點格紙底 |
| `.bg-accent-gradient` | 主題漸層底 + 深墨字 |
| `.text-accent-gradient` | 漸層文字（標誌字） |
| `.bg-highlight` | 螢光筆底色 |
| `.font-hand` | 手寫感字體 |
| `.shadow-paper` | 紙緣陰影 |
| `.shadow-accent-press` | 主要按鈕的實體陰影 |
| `.receipt-edge` | 票根鋸齒邊（放在容器底部） |

## 元件

- 基礎元件（`src/components/ui/`）已調整：按鈕膠囊化、卡片 22px 圓角不裁切、輸入框 10px 高圓角、Badge 多一個 `highlight` 變體、Tabs 改成資料夾分頁、Dialog／Sheet 紙張底與暖色遮罩。
- 手帳元件（`src/components/journal/`）：`WashiTape`（tone: accent／mint／sun）、`Stamp`、`Highlight`、`StickyNote`、`ReceiptCard` + `ReceiptList`、`DoodleUnderline`、`Logo`。
- 外框：`nav-links.tsx` 索引標籤、`theme-toggle.tsx` 深淺色、`add-entry-button.tsx` 浮動記一筆。

## 個人化

- **平台名稱**：改 `src/lib/brand.ts` 的 `BRAND_NAME`，標誌字、分頁標題、登入頁會一起換。
- **問候語**：依時段自動（早安／午安／晚安）+ 顯示名稱；**小標語**在設定頁填，存在 `profiles.slogan`。
- **深淺色**：`next-themes`，右上角切換，設定頁可選跟隨系統。
- **主題色**：設定頁的貼紙，存在瀏覽器 `localStorage`（`financial:accent`），`layout.tsx` 的 inline script 在第一次繪製前套用避免閃爍。

## 可及性

- 文字對比至少 4.5:1：主題色文字用 `--accent-ink`，次要字用 `#6F6156`／`#B8A8A1`。
- 收入與支出除了顏色也用 `+`／`−` 符號區分。
- 裝飾元素（紙膠帶、印章、波浪線）都是 `aria-hidden`。
