# 🧴 智能保養分析平台

以 **AI 成分分析** 為核心，結合個人化膚質判斷與每週保養排程管理的全端應用。上傳產品照片，即時提取成分清單，根據膚質給出專業建議，並生成個人化每週保養規劃。

## ✨ 核心功能

### 🤖 AI 成分提取
- 上傳產品照片自動識別成分表
- 使用 **Google Gemini 2.5 Flash** 進行 OCR 識別與結構化提取
- 支持英文、中文成分列表識別

### 🛡️ 雙層過濾警告系統
**法規層面** - 全球通用的禁用成分提示
- 識別已禁用或受限成分
- 顯示法規來源和限制標準

**膚質層面** - 根據個人膚質的個性化建議
- 🔴 **紅色警告** - 該膚質禁忌成分
- 🟡 **黃色提示** - 該膚質需謹慎使用
- 🟢 **綠色安全** - 該膚質友好成分
- 💜 **AI 總結** - 產品對你膚質的整體評價

### � 每週保養排程
- AI 自動根據膚質與產品庫存生成個人化保養規劃
- 拖拽式排程編輯（早晨 / 晚間 × 週一至週日）
- AI 建議添購缺少的功效品項

### 🧴 保養品庫存管理
- 新增、編輯、刪除產品，記錄成分分析結果
- 產品分類正規化（支援中英文別名）

### 👤 會員系統
- **Supabase Auth** - 郵件密碼安全登入
- **膚質檔案** - 設定膚質、性別、出生年份、肌膚問題
- **Pinia 狀態管理** - 集中處理個人資料

## 🏗️ 技術架構

| 層級 | 技術棧 |
|------|--------|
| **前端框架** | Nuxt 4 + Vue 3 Composition API |
| **狀態管理** | Pinia + @pinia/nuxt |
| **拖拽** | vuedraggable 4 |
| **後端 / API** | Nitro（Nuxt Server Routes）|
| **AI 引擎** | Google Generative AI（gemini-2.5-flash）|
| **資料庫** | Supabase（PostgreSQL）|
| **認證** | Supabase Auth + JWT |
| **部署** | Vercel（推薦）|

## 📁 專案結構

```
project_frontend/
├── pages/
│   ├── index.vue               # 成分分析入口
│   ├── beauty-plan.vue         # 保養計劃總覽
│   ├── cabinet.vue             # 保養品庫存
│   ├── profile.vue             # 個人資料中心
│   ├── profile-setup.vue       # 個人資料設定（Pinia）
│   ├── login.vue               # 登入 / 註冊
│   ├── routines/
│   │   ├── new.vue             # 新增排程
│   │   └── [id].vue            # 排程編輯（拖拽）
│   └── products/
│       └── [id]/edit.vue       # 產品編輯
├── composables/
│   ├── useCreateRoutine.ts     # 建立排程 composable
│   └── useCabinet.ts           # 保養品庫 composable
├── stores/
│   ├── useUserProfile.ts       # 個人資料 Store
│   └── useRoutinesStore.ts     # 排程 Store
├── server/
│   ├── services/aiService.ts   # Gemini AI 服務層
│   └── api/
│       ├── analyze.post.ts
│       ├── cabinet/            # 保養品 CRUD
│       ├── profile/            # 個人資料 GET / POST
│       └── routines/           # 排程 CRUD + 排序同步
├── types/
│   ├── routine.ts              # 排程相關型別
│   └── database.types.ts       # Supabase 自動生成型別
├── utils/
│   └── productCategories.ts    # 分類別名正規化
├── app.vue                     # 全域導航列
└── nuxt.config.ts
```

## 🚀 快速開始

### 環境準備

你需要提供以下 3 個服務的 API Key：

1. **Supabase**
   - 前往 [supabase.com](https://supabase.com)，建立新專案
   - 複製 **Project URL** 和 **Anon Key** (在 Settings → API)
   - 建立 **Service Role Key** (用於後端驗證)

2. **Google Gemini API**
   - 前往 [ai.google.dev](https://ai.google.dev)
   - 建立 API Key（需啟用 Generative AI API）

### 1️⃣ 克隆與安裝

```bash
git clone https://github.com/Nick921003/project_frotend.git
cd project_frotend
npm install
```

### 2️⃣ 配置環境變數

在 `beauty-analyzer/` 目錄下建立 `.env` 檔案：

```env
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NUXT_SUPABASE_SECRET_KEY=your_supabase_service_role_key
# 舊名稱（仍可相容，但建議改為上方新名稱）
# SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key
```

### 3️⃣ 啟動開發伺服器

```bash
npm run dev
```

訪問 `http://localhost:3000` (或提示的端口)

### 4️⃣ 生產打包

```bash
npm run build
npm run preview
```

## 📊 數據庫架構 (Supabase)

### 表格 1: `profiles` (未來功能)
儲存用戶膚質檔案
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  base_skin_type TEXT NOT NULL, -- 'oily', 'dry', 'combination', 'sensitive', 'normal'
  created_at TIMESTAMP DEFAULT NOW()
);

-- 觸發器：用戶註冊時自動建立檔案
```

### 表格 2: `official_ingredients` (參考數據)
全球成分禁用清單與膚質風險等級
```sql
CREATE TABLE official_ingredients (
  inci_name TEXT PRIMARY KEY,
  warning_text TEXT,                 -- 法規警告文本
  limit_standard TEXT,               -- 限制標準 (如 EU, FDA)
  skin_type_risks JSONB,             -- {"oily": "safe", "dry": "caution", ...}
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 表格 3: `user_cabinet` (用戶數據)
已分析的產品保存紀錄
```sql
CREATE TABLE user_cabinet (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  raw_ingredients JSONB,             -- 原始提取的成分列表
  analysis_result JSONB,             -- 完整分析結果 (警告、AI總結)
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔌 API 端點說明

### POST `/api/analyze`
分析美容產品成分

**請求：**
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZ...",
  "skinType": "oily"
}
```

**回應：**
```json
{
  "status": "success",
  "ingredients": ["Aqua", "Glycerin", "Sodium Chloride"],
  "warnings": {
    "regulatory": [
      {"name": "Lead", "standard": "FDA", "level": "禁用"}
    ],
    "skinType": [
      {"name": "Sodium Chloride", "type": "oily", "message": "容易加重出油"}
    ]
  },
  "summary": "該產品含有...",
  "safeIngredients": ["Glycerin"]
}
```

### POST `/api/cabinet/save`
保存產品到個人柜台 (需認證)

**請求：**
```json
{
  "productName": "某品牌面膜",
  "rawIngredients": ["成分1", "成分2"],
  "analysisResult": {...}
}
```

**回應：**
```json
{
  "success": true,
  "message": "產品已保存",
  "id": 123
}
```

## 🧪 測試流程

### 1. 訪客模式測試
- 訪問首頁
- 選擇膚質 (如 "油性肌膚")
- 上傳美容產品照片
- 檢視成分分析結果

### 2. 會員功能測試
- 點擊「前往登入」
- **新用戶：** 選擇「註冊」，輸入郵件/密碼，選擇膚質
- **現有用戶：** 輸入認證資訊
- 成分分析後，點擊「保存到柜台」
- 查看保存記錄

## 🔐 安全特性

✅ **後端驗證** - API 端點驗證用戶身份  
✅ **Service Key 隔離** - 敏感操作使用 Service Role Key  
✅ **SQL 隱射防護** - Supabase Realtime 與 RLS 政策  
✅ **環境變數保護** - API Key 存儲於 `.env`（已加入 .gitignore）  
✅ **HTTPS 傳輸** - 生產環境自動 HTTPS  

## 🛠️ 故障排除

### ❌ "Error: supabaseUrl is required"
檢查 `.env` 是否正確配置 `SUPABASE_URL`

### ❌ "Gemini API 超額"
檢查 API Key 配額，或升級為付費方案

### ❌ 上傳圖片無反應
確認圖片大小 < 10MB，格式為 JPG/PNG

## 📚 參考資源

- [Nuxt 官方文檔](https://nuxt.com)
- [Supabase 教程](https://supabase.com/docs)
- [Google Generative AI SDK](https://github.com/google/generative-ai-js)
- [INCI 成分資料庫](https://incidecoder.com)

## 📝 授權

本專案採用 MIT 授權。詳見 [LICENSE](./LICENSE) 檔案。

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📞 聯絡方式

有任何問題或建議，歡迎開立 GitHub Issue。

## ☁️ 部署至 Vercel

本專案使用 GitHub Actions 自動部署至 Vercel（`.github/workflows/deploy.yml`）。

### 1️⃣ 連結 Vercel 專案

```bash
npm i -g vercel
vercel login
vercel link   # 執行後查看 .vercel/project.json 取得 ID
```

### 2️⃣ 在 GitHub 設定 Secrets

前往 `Settings → Secrets and variables → Actions`：

| Secret 名稱 | 取得位置 |
|-------------|----------|
| `VERCEL_TOKEN` | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

### 3️⃣ 在 Vercel 設定環境變數

Vercel 專案 → Settings → Environment Variables：

```
SUPABASE_URL
SUPABASE_ANON_KEY
NUXT_SUPABASE_SECRET_KEY
GEMINI_API_KEY
```

### 4️⃣ 推送觸發自動部署

```bash
git push origin main
# main 分支 → 正式環境
# Pull Request → 預覽環境（Preview URL）
```

---

**最後更新：** 2026 年 4 月 16 日

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
