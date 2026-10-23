# 設定教學：Brevo 寄信與 Supabase 登入設定

這份教學給專案擁有者自己操作。全部做完大約 20 分鐘，不需要寫程式。
做完後，註冊確認信與重設密碼信會由 Brevo 寄出，登入連結會正確導回網站。

> 為什麼要這樣做：Supabase 內建的寄信只供測試、額度極低；Brevo 免費方案每天 300 封，
> 而且不需要自己的網域，只要驗證一個寄件信箱。

---

## 第一部分：申請 Brevo 並拿到 SMTP 資料

### 1. 註冊 Brevo
1. 開啟 https://www.brevo.com ，點右上 **Sign up free**。
2. 用你的 Email 註冊，到信箱點確認信，依畫面填公司名稱（可填「財報記帳平台」）與基本資料。
3. 登入後若出現導覽精靈，可先略過。

### 2. 驗證寄件信箱（Sender）
1. 點右上角你的帳號名稱 → **Senders, Domains & Dedicated IPs**（或左側選單 **Senders**）。
2. 在 **Senders** 分頁點 **Add a sender**。
3. **From name** 填「財報記帳平台」，**From email** 填你要用來寄信的信箱（例如你的 Gmail），儲存。
4. 到該信箱收 Brevo 的驗證信，點 **Confirm**。回到 Senders 頁面應顯示已驗證（綠色勾）。

> 之後 Supabase 的「Sender email」必須填這個已驗證的信箱，否則 Brevo 會拒收。

### 3. 建立 SMTP key
1. 點右上角帳號名稱 → **SMTP & API**。
2. 切到 **SMTP** 分頁，點 **Generate a new SMTP key**，名稱填 `supabase`。
3. 畫面會顯示一次性的 SMTP key（一長串），**立刻複製存好**，關掉後就看不到了。
4. 同一頁會顯示連線資訊，記下：
   - SMTP Server：`smtp-relay.brevo.com`
   - Port：`587`
   - Login：你的 Brevo 帳號 Email
   - Password：剛才產生的 SMTP key

---

## 第二部分：Supabase 設定

登入 https://supabase.com/dashboard ，開啟專案 **financial**，左側點 **Authentication**。
（Supabase 的介面偶爾會調整分頁名稱，找不到時用左側的搜尋。）

### 4. 填入自訂 SMTP
1. Authentication → **Emails** → 分頁 **SMTP Settings**。
2. 打開 **Enable Custom SMTP**。
3. 依序填：
   - **Sender email**：第 2 步驗證過的信箱
   - **Sender name**：`財報記帳平台`
   - **Host**：`smtp-relay.brevo.com`
   - **Port number**：`587`
   - **Username**：你的 Brevo 帳號 Email
   - **Password**：SMTP key
4. 點 **Save**。

### 5. 設定網址（讓確認信的連結導回網站）
1. Authentication → **URL Configuration**。
2. **Site URL** 填：`https://financial-xicheng.vercel.app`
3. **Redirect URLs** 點 **Add URL**，逐一加入這三筆：
   - `https://financial-xicheng.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`
   - `https://financial-*-xicheng.vercel.app/auth/callback`
4. 儲存。

### 6. 確認「信箱驗證」是開啟的
1. Authentication → **Sign In / Providers** → 點 **Email**。
2. 確認 **Confirm email** 是開啟（預設就是開啟），其餘不動，儲存。

### 7. 把信件改成繁體中文（選做，但建議）
Authentication → **Emails** → 分頁 **Templates**，分別修改兩個範本後儲存。

**Confirm sign up**（註冊確認信）
- Subject：`確認你的財報記帳平台帳號`
- Body：
```html
<h2>歡迎使用財報記帳平台</h2>
<p>請點擊下方連結確認你的信箱，完成註冊：</p>
<p><a href="{{ .ConfirmationURL }}">確認信箱</a></p>
<p>如果你沒有註冊，請忽略這封信。</p>
```

**Reset password**（重設密碼信）
- Subject：`重設你的財報記帳平台密碼`
- Body：
```html
<h2>重設密碼</h2>
<p>我們收到了重設密碼的要求。請點擊下方連結設定新密碼：</p>
<p><a href="{{ .ConfirmationURL }}">重設密碼</a></p>
<p>如果不是你提出的要求，請忽略這封信，密碼不會改變。</p>
```

### 8. 寄信額度（選做）
Authentication → **Rate Limits**：啟用自訂 SMTP 後，Supabase 預設每小時最多寄 30 封。
開發期夠用；之後使用者變多再調高。

---

## 第三部分：確認有沒有設定成功

1. 網站上線後到 `/signup` 用一個你收得到信的信箱註冊。
2. 一分鐘內應收到「確認你的財報記帳平台帳號」的信，寄件者顯示「財報記帳平台」。
3. 點信中連結，應該回到網站並進入引導頁。

**收不到信時依序檢查**：
- Brevo → Senders：寄件信箱是否已驗證。
- Supabase → Authentication → Emails → SMTP Settings：Sender email 是否與 Brevo 驗證的信箱一致、密碼是否為 SMTP key（不是 Brevo 登入密碼）。
- Brevo 首頁 → **Transactional** → **Logs**：可看到每封信的寄送狀態與錯誤原因。
- 垃圾郵件匣。

**點連結後出現錯誤時**：
- Supabase → URL Configuration 的 Redirect URLs 是否包含你正在用的網址（正式站、localhost 或 preview）。
- 連結只能用一次且會過期，重新申請一封即可。
