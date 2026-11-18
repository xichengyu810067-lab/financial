# 設定 Google 登入

程式已經做好「使用 Google 登入」按鈕。要真的能用，需要在 Google Cloud 和 Supabase 後台各設定一次（約 10 分鐘）。還沒設定前按下按鈕，畫面會顯示「Google 登入尚未啟用，請先用 Email 登入」，不會壞掉。

下面用到兩個網址：

- Supabase 專案的回呼網址：`https://<專案代號>.supabase.co/auth/v1/callback`。專案代號就是 `.env.local` 裡 `NEXT_PUBLIC_SUPABASE_URL` 的那一段。
- 正式站網址：`https://financial-xicheng.vercel.app`

## 1. Google Cloud Console：建立 OAuth 用戶端

1. 到 <https://console.cloud.google.com/>，左上角選一個專案（沒有就按「新增專案」，名稱隨意，例如「財報平台」）。
2. 左側選單 → **API 和服務** → **OAuth 同意畫面**（新版介面叫 **Google Auth Platform** → **品牌宣傳**）：
   - 使用者類型選 **外部**。
   - 應用程式名稱填「財報平台」，使用者支援電子郵件和開發人員聯絡資訊填你自己的信箱。
   - 範圍（Scopes）只需要預設的 `openid`、`.../auth/userinfo.email`、`.../auth/userinfo.profile`，不用另外加。
   - **發布狀態**：維持「測試中」的話，只有加進「測試使用者」名單的 Google 帳號能登入（最多 100 個）；要開放給所有人，按「發布應用程式」。只用這三個基本範圍，發布不需要 Google 審查。
3. 左側 → **憑證**（新版叫 **用戶端**）→ **建立憑證** → **OAuth 用戶端 ID**：
   - 應用程式類型：**網頁應用程式**。
   - 名稱：隨意，例如「財報平台 Supabase」。
   - **已授權的 JavaScript 來源**：`https://financial-xicheng.vercel.app` 和 `http://localhost:3000`。
   - **已授權的重新導向 URI**：只填 Supabase 的回呼網址 `https://<專案代號>.supabase.co/auth/v1/callback`（不是我們網站的 `/auth/callback`）。
   - 按「建立」後會出現 **用戶端 ID** 和 **用戶端密鑰**，下一步要用。密鑰只貼到 Supabase 後台，不要放進程式碼或 `.env.local`。

## 2. Supabase 後台：啟用 Google

1. Supabase 後台 → 專案 → **Authentication** → **Sign In / Providers**（舊版叫 Providers）→ **Google**。
2. 打開 **Enable Sign in with Google**，貼上剛才的 **Client ID** 和 **Client Secret**，按 **Save**。
3. 這一頁也會顯示 **Callback URL (for OAuth)**，應該和第 1 步填的重新導向 URI 完全一樣；不一樣就以這裡顯示的為準，回 Google 改。

## 3. Supabase 後台：確認允許的重新導向網址

**Authentication** → **URL Configuration**：

- **Site URL**：`https://financial-xicheng.vercel.app`
- **Redirect URLs** 要包含（設定 Email 登入時應該已經加過）：
  - `https://financial-xicheng.vercel.app/**`
  - `http://localhost:3000/**`
  - 想讓 Vercel 預覽部署也能登入，再加 `https://financial-*-xicheng.vercel.app/**`

## 4. 試一次

1. 開正式站登入頁，按「使用 Google 登入」→ 選 Google 帳號 → 同意。
2. 第一次用這個 Google 帳號：會建立新帳號和一本新帳本，顯示名稱用 Google 上的名字，接著進到引導頁。
3. 這個 Google 信箱之前已經用 Email 註冊、而且點過確認信：Supabase 會自動把兩種登入方式合併成同一個帳號，看到原本那本帳本，不會多一個帳號。

## 會遇到的情況

| 情況 | 結果 |
|---|---|
| 在 Google 畫面按「取消」 | 回到登入頁，顯示「你取消了 Google 授權…」 |
| Google 顯示 `redirect_uri_mismatch` | 第 1 步的重新導向 URI 跟 Supabase 的 Callback URL 不一樣，照第 2 步第 3 點對一下 |
| Google 顯示「存取權遭拒／應用程式未經驗證」 | 同意畫面還在「測試中」，而這個 Google 帳號不在測試使用者名單；加進名單或發布應用程式 |
| 登入後回到首頁而不是帳本 | 第 3 步的 Redirect URLs 沒有包含目前這個網址 |
| 同信箱的 Email 帳號**還沒點確認信**就用 Google 登入 | 為了防止別人先用你的信箱註冊來搶帳號，Supabase 會移除那個未確認的密碼登入方式，只留 Google；需要密碼的話，登入後用「忘記密碼」重新設一個 |
| 用 Google 註冊的帳號想改用密碼登入 | 在登入頁按「忘記密碼？」寄重設信，設好密碼後兩種方式都能登入 |
