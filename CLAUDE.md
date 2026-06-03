# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
```

No test suite or linter configured.

## Stack

- **Nuxt 4 + Vue 3** (Composition API, file-based routing via `/pages`)
- **Supabase** — auth (JWT) + PostgreSQL database
- **Pinia** — state management (`stores/useUserProfile.ts` only)
- **Tailwind CSS** — via `@nuxtjs/tailwindcss`; used for **new components only**
- **Google Generative AI** — `gemini-3.5-flash`, server-side only via `server/services/aiService.ts`
- **Nitro** — server API routes under `server/api/`
- **Native HTML5 Drag API** — routine item reordering in `components/routine/`

## CSS / Styling Strategy

> **修改任何樣式前，必須先讀 `design.md`**，確認 token 名稱與元件 class，再動 CSS / Vue。

| 情境 | 做法 |
|------|------|
| 新元件 / 新頁面 | 優先用 Tailwind class，不開 `<style scoped>` |
| 既有元件修改 | 維持原有 `<style scoped>`，局部加 Tailwind 輔助即可 |
| 全域 token | 永遠用 CSS 變數（`--color-accent` 等），不寫死顏色 |

Tailwind 橋接 token：`bg-surface`、`text-accent`、`border-border`、`font-heading`、`font-body`。
設定檔：`tailwind.config.ts`。`preflight: false` 避免 CSS reset 衝擊既有樣式。

**禁用 emoji 作為 icon** — 改用 CSS 形狀或 SVG。

## Architecture Rules

### Auth pattern
Every server API endpoint calls `serverSupabaseUser(event)` and throws 401 if not logged in. There is no global middleware — auth is checked per-endpoint. Guest mode is supported in `analyze.post.ts` (daily limit enforced via service key).

**userId 取法（固定寫法）：**
```typescript
const userId = user.id || user.sub;
if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
```

**宣告順序陷阱：** `useSupabaseUser()` 必須在任何引用 `user.value` 的 `watchEffect` / `computed` 之前宣告，否則 TDZ 錯誤。

### Supabase query safety
RLS 不能取代明確的 `user_id` 過濾。凡刪除 / 查詢使用者私有資料時，**務必加上 `.eq('user_id', userId)`**，不能只靠 RLS。

Two Supabase clients exist:
- `serverSupabaseClient(event)` — user-scoped, respects RLS, used for most queries
- `NUXT_SUPABASE_SECRET_KEY` service key — used when admin-level access is needed

### Cabinet API
- `raw_ingredients` column is NOT NULL — only written on initial `save.post.ts`, **never updated** by `[id].put.ts`
- PUT only updates `product_name`, `product_category`, and tracking fields (`opened_at`, `expires_at`, `estimated_finish_days`, `purchase_purpose`, `user_notes`)

### Routine generation
AI routine generation uses a **180 s timeout** (vs 60 s default) — Gemini can be slow. Timeout errors are detected in `useCreateRoutine.ts` and shown with a specific UX message.

### Category normalization
Always use `normalizeProductCategory()` from `~/utils/productCategories` when reading/writing `product_category`. It maps Chinese aliases and English names (e.g. `serum` → `精華液`) to one of 8 canonical values. This runs on both client and server.

### Daily check-in (`routine_checkins`)
- Toggle: `POST /api/routines/checkins/toggle` — body: `{ routine_item_id, checked_date }`
- Read: `GET /api/routines/[id]/checkins?date=YYYY-MM-DD` — returns `{ checked_ids: string[] }`
- **Vue reactivity:** always do `checkedItemIds.value = new Set(checkedItemIds.value)` after mutation

## Environment variables

```
SUPABASE_URL
SUPABASE_ANON_KEY
NUXT_SUPABASE_SECRET_KEY   # Service role key — server only
GEMINI_API_KEY             # Server only (set in runtimeConfig.geminiApiKey)
```

## efficacy_tags Field

`official_ingredients.efficacy_tags` uses fixed vocabulary:
`moisturizing / exfoliating / antioxidant / soothing / brightening / sunscreen / anti_acne / anti_aging / emollient / preservative`

Populated by `scripts/populate-efficacy-tags.mjs`.

## PAO（開封後使用期限）預設

`expires_at` 由 `autoCalcExpiry()` 在 `pages/products/[id]/edit.vue` 根據開封日 + 類別自動推算：

| 類別 | 月數 |
|------|------|
| 精華液、眼霜、去角質 | 6 個月 |
| 乳液、乳霜、面霜、防曬 | 12 個月 |
| 其他 | 12 個月（預設）|

## DB Migrations

Run via Supabase MCP (`mcp__claude_ai_Supabase__apply_migration`).

## PROJECT_PLAN.md 維護規則

完成以下任一項後，**主動告知使用者需要更新 `PROJECT_PLAN.md`**，並詢問是否協助更新：

- 新增或刪除頁面（`/pages`）
- 新增或移除 server API 路由（`/server/api`）
- 新增 DB migration / 新欄位 / 新表
- 新增或移除 composable / store
- 功能模組狀態變更（backlog → 完成）
