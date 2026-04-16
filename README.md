# 🧴 美容產品成分分析器 (Beauty Analyzer)

一個使用 **AI 智能分析** 和 **個性化膚質判斷** 的美容產品成分檢測平台。上傳產品照片，即時提取成分清單，並根據你的膚質類型給出專業的安全建議。

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

### 👤 會員系統
- **Supabase 雙因素認證** - 郵件密碼安全登入
- **膚質檔案** - 首次註冊時選擇膚質類型（油性/乾性/混合/敏感/中性）
- **個人柜台** - 保存已分析的產品供日後查看

## 🏗️ 技術架構

| 層級 | 技術棧 |
|------|--------|
| **前端框架** | Nuxt 4 + Vue 3 (Composition API) |
| **樣式** | 內聯 CSS (可擴展為 Tailwind/UnoCSS) |
| **後端/API** | Nitro (Nuxt Server) |
| **AI 引擎** | Google Generative AI (gemini-2.5-flash) |
| **數據庫** | Supabase (PostgreSQL) |
| **認證** | Supabase Auth + JWT |
| **部署目標** | Vercel/Netlify (支持無伺服器環境) |

## 📁 專案結構

```
beauty-analyzer/
├── pages/                         # Nuxt 頁面路由
│   ├── index.vue                  # 成分分析 + 入櫃入口
│   ├── beauty-plan.vue            # 排程總覽
│   ├── routines/new.vue           # 新增/AI 偏好設定
│   ├── routines/[id].vue          # 排程編輯與推薦展示
│   ├── products/[id]/edit.vue     # 產品編輯
│   ├── profile.vue                # 個資中心
│   ├── profile-setup.vue          # 個資設定（Store 版本）
│   ├── cabinet.vue                # 保養品櫃
│   └── login.vue                  # 登入/註冊
├── composables/
│   ├── useCreateRoutine.ts        # 建立排程流程封裝
│   └── useCabinet.ts              # 保養品櫃流程封裝
├── stores/
│   └── useUserProfile.ts          # 個資 Store
├── server/
│   ├── services/
│   │   └── aiService.ts           # AI 服務層（Prompt + Gemini 調用）
│   └── api/
│       ├── analyze.post.ts
│       ├── cabinet/*
│       ├── profile/*
│       └── routines/*
├── utils/
│   └── productCategories.ts       # 分類單一來源與正規化
├── types/
│   ├── routine.ts
│   └── database.types.ts
├── app.vue
├── nuxt.config.ts
├── package.json
└── .env
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
cd project_frotend/beauty-analyzer
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

---

**最後更新：** 2026 年 4 月 9 日

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
