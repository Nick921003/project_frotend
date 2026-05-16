# Beauty Analyzer — 專案現況文件

**最後更新**：2026-05-16（今日打卡頁 UI 重設計）
**技術棧**：Nuxt 4 + Vue 3 + Supabase + Google Gemini 2.5 Flash

> **維護規則**：有功能新增、頁面異動、API 變更、DB migration 時，**必須同步更新此檔**。

---

## 已完成功能

| 功能模組 | 狀態 | 說明 |
|---------|------|------|
| 成分分析引擎 | ✅ | 上傳圖片 → Gemini OCR → 法規 + 膚質雙層分析 |
| 訪客模式 | ✅ | 未登入可分析，每日上限 3 次（service key 計數） |
| 保養品庫 | ✅ | 新增 / 查看 / 編輯 / 刪除產品，含搜尋 + 分頁 |
| PAO 追蹤 | ✅ | 開封日 + 類別自動推算 expires_at，到期警告 |
| 每週保養規劃 | ✅ | 建立規劃、拖拽排程、鎖定項目 |
| AI 規劃生成 | ✅ | Gemini 依膚質 + 庫存生成規劃（180 s timeout） |
| 今日保養打卡 | ✅ | `/routines/active` 逐項打卡，每日切換；進度卡 + Timeline 步驟 + 完成 banner |
| AI 功效推薦 | ✅ | 分析現有庫存功效缺口，給出補充建議 |
| 個人資料 | ✅ | 膚質、年齡、性別、肌膚問題、suppress_safety_warnings |
| 用戶認證 | ✅ | Supabase Auth，Email/密碼 + Google OAuth，per-endpoint 401 |
| Google Drive 上傳 | ✅ | Picker 多選圖片（含 HEIC），server 端轉 JPEG 預覽 |
| 管理後台 | ✅ | `/admin`：統計、系統設定 |

---

## 頁面清單

| 路徑 | 檔案 | 功能 | 需登入 |
|------|------|------|--------|
| `/` | `pages/index.vue` | 成分分析（上傳 + 結果顯示） | 否（訪客限3次） |
| `/login` | `pages/login.vue` | 登入 / 註冊 | — |
| `/profile-setup` | `pages/profile-setup.vue` | 初次設定個人資料 | 是 |
| `/profile` | `pages/profile.vue` | 編輯個人資料 | 是 |
| `/beauty-plan` | `pages/beauty-plan.vue` | 保養品庫 + 規劃列表管理 | 是 |
| `/products/[id]/edit` | `pages/products/[id]/edit.vue` | 編輯產品（PAO、備註等） | 是 |
| `/routines/new` | `pages/routines/new.vue` | AI 功效推薦（缺口分析） | 是 |
| `/routines/[id]` | `pages/routines/[id].vue` | 規劃詳情 + 拖拽編輯 | 是 |
| `/routines/active` | `pages/routines/active.vue` | 今日保養（唯讀 + 打卡） | 是 |
| `/admin` | `pages/admin.vue` | 管理後台 | 是（管理員） |

---

## Server API 路由

### Cabinet
| Method | 路徑 | 功能 |
|--------|------|------|
| POST | `/api/cabinet/save` | 儲存分析結果 + raw_ingredients |
| GET | `/api/cabinet/list` | 列表（含搜尋、分頁） |
| GET | `/api/cabinet/[id]` | 單一產品詳情 |
| PUT | `/api/cabinet/[id]` | 更新產品資訊（不含 raw_ingredients） |
| DELETE | `/api/cabinet/[id]` | 刪除產品 |

### Routines
| Method | 路徑 | 功能 |
|--------|------|------|
| POST | `/api/routines/create` | 建立規劃（AI 或手動） |
| GET | `/api/routines/list` | 規劃清單 |
| GET | `/api/routines/active` | 取得當前 active 規劃 |
| GET | `/api/routines/[id]` | 規劃詳情 |
| DELETE | `/api/routines/[id]` | 刪除規劃 |
| PUT | `/api/routines/[id]/toggle-active` | 切換 is_active |
| PUT | `/api/routines/[id]/meta` | 更新規劃名稱等 meta |
| GET | `/api/routines/[id]/checkins` | 某日打卡狀態 |
| POST | `/api/routines/[id]/efficacy-recs` | AI 功效缺口推薦 |
| POST | `/api/routines/checkins/toggle` | 打卡 toggle |
| PATCH | `/api/routines/items/[id]/lock` | 鎖定 / 解鎖 routine_item |
| POST | `/api/routines/update-order` | 重排項目順序 |
| POST | `/api/routines/update-themes` | 更新規劃主題標籤 |

### 其他
| Method | 路徑 | 功能 |
|--------|------|------|
| POST | `/api/analyze` | 成分分析（支援訪客） |
| POST | `/api/convert-heic` | HEIC → JPEG 轉換（heic-convert WASM，不需登入） |
| GET | `/api/profile/get` | 取得個人資料 |
| POST | `/api/profile/update` | 更新個人資料 |
| GET | `/api/auth/registration-status` | 檢查是否開放註冊 |
| GET/POST | `/api/admin/settings` | 系統設定 |
| GET | `/api/admin/stats` | 使用統計 |

---

## 資料庫現況

| Table | 重要欄位 |
|-------|---------|
| `profiles` | base_skin_type, age_group, gender, issues, suppress_safety_warnings |
| `user_cabinet` | product_name, product_category, raw_ingredients (NOT NULL), analysis_result (JSONB), overview, opened_at, expires_at, estimated_finish_days, purchase_purpose, user_notes |
| `official_ingredients` | inci_name, warning_text, skin_type_risks (JSONB), efficacy_tags (text[]), function_summary |
| `cosmetic_regulations` | TFDA 台灣法規 |
| `routines` | user_id, name, is_active (唯一) |
| `routine_items` | routine_id, product_id, day_of_week, time_of_day, sequence_order, is_locked |
| `routine_checkins` | routine_item_id, checked_date（unique 組合）、RLS |

---

## 核心 Composables

| 檔案 | 功能 |
|------|------|
| `composables/useCabinet.ts` | 產品清單、搜尋、分頁、debounce |
| `composables/useCreateRoutine.ts` | AI / 手動建立規劃，180 s timeout 處理 |
| `composables/useRoutineDragDrop.ts` | 拖拽排程邏輯 |
| `composables/useRoutineRecommendations.ts` | AI 功效推薦流程 |
| `composables/useGoogleDrivePicker.ts` | Google Drive Picker，含 HEIC 伺服器端轉換 |
| `stores/useUserProfile.ts` | Pinia：全站共用使用者資料 |

---

## Backlog（尚未實作）

- 成分使用趨勢分析（哪些成分跨產品重複出現）
- 規劃 / 排程分享功能

---

## 設計參考

樣式規範見 `design.md`，CSS 變數定義在 `assets/css/main.css`。
