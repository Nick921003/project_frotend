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
- **Pinia** — state management (profile store only; everything else uses composables)
- **Tailwind CSS** — via `@nuxtjs/tailwindcss`; used for **new components only**
- **Google Generative AI** — `gemini-2.5-flash`, server-side only via `server/services/aiService.ts`
- **Nitro** — server API routes under `server/api/`
- **vuedraggable 4** — drag-and-drop routine item reordering in `routines/[id].vue`

## CSS / Styling Strategy

**Hybrid approach — do NOT rewrite existing styles:**

| 情境 | 做法 |
|------|------|
| 新元件 / 新頁面 | 優先用 Tailwind class，不開 `<style scoped>` |
| 既有元件修改 | 維持原有 `<style scoped>`，局部加 Tailwind 輔助即可 |
| 全域 token | 永遠用 CSS 變數（`--color-accent` 等），不寫死顏色 |

Tailwind 已橋接設計 token，可直接用：`bg-surface`、`text-accent`、`border-border`、`font-heading`、`font-body`。
設定檔：`tailwind.config.ts`。`preflight: false` 避免 CSS reset 衝擊既有樣式。

**禁用 emoji 作為 icon**（跨平台渲染不一致）— 改用 CSS 形狀或 SVG。

## Architecture

### Auth pattern
Every server API endpoint calls `serverSupabaseUser(event)` and throws 401 if not logged in. There is no global middleware — auth is checked per-endpoint. Guest mode is explicitly supported on the analyze page (no auth required).

Two Supabase clients exist:
- `serverSupabaseClient(event)` — user-scoped, respects RLS, used for most queries
- `NUXT_SUPABASE_SECRET_KEY` service key — used when admin-level access is needed

**userId 取法（固定寫法）：**
```typescript
const userId = user.id || user.sub;
if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
```

**宣告順序陷阱：** `useSupabaseUser()` 必須在任何引用 `user.value` 的 `watchEffect` / `computed` 之前宣告，否則 TDZ 錯誤。

### Supabase query safety
RLS 不能取代明確的 `user_id` 過濾。凡刪除 / 查詢使用者私有資料時，**務必加上 `.eq('user_id', userId)`**，不能只靠 RLS。

### AI analysis flow (`POST /api/analyze`)
1. Accept `imageBase64` (single) or `imageBase64Array` (multiple) — both supported
2. Call `aiService.extractIngredientsFromImage()` → Gemini OCR
3. Query `official_ingredients` + `cosmetic_regulations` tables
4. Classify ingredients into 4 buckets: `regulatoryAlerts` / `limitAlerts` / `skinTypeAlerts` / `safeList`
5. Call `aiService.generateProductSummary()` → AI overview text
6. Return combined object; `analysis_result` JSONB saved to `user_cabinet`

The `analysis_result` column structure is:
```
{ rawAiOutput, detectedProductName, analysis: { regulatoryAlerts, limitAlerts, skinTypeAlerts, safeList }, overallSummary }
```
`overview` is a separate TEXT column (the AI summary string, pulled out for easy display).

### Cabinet (product) API
- `raw_ingredients` column is NOT NULL — only written on initial `save.post.ts`, never updated by `[id].put.ts`
- PUT only updates `product_name`, `product_category`, and tracking fields (`opened_at`, `expires_at`, `estimated_finish_days`, `purchase_purpose`, `user_notes`)

### Routine generation
AI routine generation uses a 180 s timeout (vs 60 s default) — Gemini can be slow. Timeout errors are detected in `useCreateRoutine.ts` and shown with a specific UX message.

### Category normalization
Always use `normalizeProductCategory()` from `~/utils/productCategories` when reading/writing `product_category`. It maps Chinese aliases and English names (e.g. `serum` → `精華液`) to one of 8 canonical values. This runs on both client and server.

### State management scope
Pinia (`stores/useUserProfile.ts`) is only used for the user profile — shared across pages. Cabinet products and routines use composables (`useCabinet.ts`, `useCreateRoutine.ts`) with direct `$fetch` calls; no global store for them.

### Daily check-in (`routine_checkins`)
- Toggle: `POST /api/routines/checkins/toggle` — body: `{ routine_item_id, checked_date }`
- Read: `GET /api/routines/[id]/checkins?date=YYYY-MM-DD` — returns `{ checked_ids: string[] }`
- Vue reactivity: always do `checkedItemIds.value = new Set(checkedItemIds.value)` after mutation

### Today's routine page (`/routines/active`)
`pages/routines/active.vue` is a **read-only** routine view (not a redirect). Shows today's day auto-selected, check-in buttons, and an Edit button to `/routines/[id]`. Fetches from `GET /api/routines/active`.

## Key files

| Path | Purpose |
|------|---------|
| `server/services/aiService.ts` | All Gemini API calls (OCR + summaries + routine prompts) |
| `server/api/analyze.post.ts` | Dual-layer ingredient analysis (regulatory + skin-type) |
| `utils/productCategories.ts` | Canonical category list + alias normalization |
| `types/routine.ts` | Domain types: `CabinetProduct`, `RoutineItem`, `WeeklyRoutine` |
| `types/database.types.ts` | Auto-generated Supabase types — do not edit manually |
| `composables/useCreateRoutine.ts` | AI/default routine generation with timeout handling |
| `composables/useCabinet.ts` | Product list with debounced search + pagination |
| `tailwind.config.ts` | Tailwind config；橋接設計 token，`preflight: false` |

## Database tables

| Table | Notes |
|-------|-------|
| `profiles` | User skin type, age, gender, issues; `suppress_safety_warnings boolean` |
| `user_cabinet` | User products; `raw_ingredients` NOT NULL; `analysis_result` JSONB; `expires_at DATE` |
| `official_ingredients` | Global ingredient warnings + `skin_type_risks` JSONB |
| `cosmetic_regulations` | TFDA Taiwan-specific rules |
| `routines` | Routine metadata; `is_active` flag (only one active at a time) |
| `routine_items` | `is_locked = true` items are skipped during AI regeneration |
| `routine_checkins` | Daily check-in records; RLS enabled; unique on `(routine_item_id, checked_date)` |

## Environment variables

```
SUPABASE_URL
SUPABASE_ANON_KEY
NUXT_SUPABASE_SECRET_KEY   # Service role key — server only
GEMINI_API_KEY             # Server only (set in runtimeConfig.geminiApiKey)
```

## Design System（文清風）

Design tokens defined in `assets/css/main.css` `:root`. **Never hardcode colors — always use CSS variables.**

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-bg` | `#F5F0EB` | Page background |
| `--color-surface` | `#FFFFFF` | Card/panel background |
| `--color-surface-alt` | `#EDE7E0` | Secondary surface |
| `--color-accent` | `#C4958A` | 霧玫 — primary CTA |
| `--color-sage` | `#8FA89C` | 霧綠 — success/save |
| `--color-warm` | `#E8DDD0` | 暖米 — decorative |
| `--color-warm-dark` | `#C4B5A5` | 淺棕 — decorative |
| `--color-red` | `#B86B6B` | 錯誤 / 過期警告 |
| `--color-amber` | `#C49A6A` | 即將到期警告 |
| `--color-text-primary` | `#3D3530` | Body text |
| `--color-text-secondary` | `#7A6E68` | Subdued text |
| `--font-heading` | `Noto Serif TC` | Headings only |
| `--font-body` | `Noto Sans TC` | All body copy |

**Principles:** Large whitespace, 1px borders, minimal icons (functional only), no rounded-corner stacking. **No emoji as icons** — use CSS or SVG.

Spacing tokens: `--space-1` (4px) 到 `--space-12`. **`--space-sm` 不存在**，用 `--space-2` (8px)。

## DB Migrations

Run via Supabase MCP (`mcp__claude_ai_Supabase__apply_migration`). Applied migrations:

1. `official_ingredients`: added `efficacy_tags text[]`, `function_summary text`
2. `user_cabinet`: added `opened_at timestamptz`, `estimated_finish_days integer`, `purchase_purpose text`, `user_notes text`
3. `profiles`: added `suppress_safety_warnings boolean NOT NULL DEFAULT FALSE`
4. `routine_checkins`: new table with RLS (user owns their own checkins)
5. `user_cabinet`: added `expires_at DATE`

## efficacy_tags Field

`official_ingredients.efficacy_tags` uses fixed vocabulary:
`moisturizing / exfoliating / antioxidant / soothing / brightening / sunscreen / anti_acne / anti_aging / emollient / preservative`

Populated by `scripts/populate-efficacy-tags.mjs`. Returned in `analyze.post.ts` response as part of `safeList` items and `efficacySummary.primaryTags`.

## PAO（開封後使用期限）預設

`expires_at` 由 `autoCalcExpiry()` 在 `pages/products/[id]/edit.vue` 根據開封日 + 類別自動推算：

| 類別 | 月數 |
|------|------|
| 精華液、眼霜、去角質 | 6 個月 |
| 乳液、乳霜、面霜、防曬 | 12 個月 |
| 其他 | 12 個月（預設）|
