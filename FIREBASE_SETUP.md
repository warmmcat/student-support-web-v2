# Firebase 後端設定（student-support-web-v2）

此專案使用 Firebase Authentication + Cloud Firestore。GitHub 僅存放前端程式與 Firestore Security Rules，不存放抽籤紀錄。

## 1. 建立 Firebase 專案

請以管理用 Google 帳號登入 Firebase Console，建立一個專案，例如 `student-support-web-v2`。

## 2. 啟用 Google Authentication

Firebase Console → Authentication → Sign-in method → Google → Enable。

並在 Authentication → Settings → Authorized domains 加入：

- `warmmcat.github.io`

## 3. 建立 Firestore Database

Firebase Console → Firestore Database → Create database。

建議選擇離臺灣較近的區域，並使用 Production mode。

## 4. 建立 Web App 並填入設定

Firebase Console → Project settings → Your apps → Web app。

取得 Firebase configuration 後，把 `js/firebase-config.js` 中的空白欄位填入。

Firebase Web config 是前端識別設定；真正的資料保護依賴 Authentication + Firestore Security Rules。不要把 service account private key、Admin SDK private key 或其他伺服器密鑰放入 GitHub。

## 5. 部署 Firestore Security Rules

將 repository 的 `firestore.rules` 內容部署到 Firebase Console → Firestore Database → Rules。

## 6. 建立管理者白名單

第一次用管理用 Google 帳號登入網站後，到 Firebase Console → Authentication → Users，複製該帳號的 UID。

接著在 Firestore 建立：

- Collection: `admins`
- Document ID: 管理者 UID
- 欄位可加入 `role: "admin"`（規則實際上只檢查該文件是否存在）

一般使用者無法自行建立或修改 `admins` 文件。

## 7. 建立存取設定

Firestore 建立：

- Collection: `config`
- Document ID: `access`
- Boolean field: `restrictToTmu = false`

之後管理者可以直接在 `/admin.html` 切換是否限定 `@tmu.edu.tw`。

## 8. 設定一年 TTL

Firestore 每筆 `draws` 文件都有 `expireAt` 欄位。

Google Cloud Console → Firestore → Time-to-live → Create policy：

- Collection group: `draws`
- Timestamp field: `expireAt`

設定後，資料到期會由 Firestore TTL 自動清除。

## 9. 後台網址

部署完成後：

`https://warmmcat.github.io/student-support-web-v2/admin.html`

網址本身可以公開，但資料仍受 Firebase Authentication 與 Firestore Security Rules 保護；未在 `admins/{uid}` 白名單的使用者無法讀取抽籤資料。
