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
- **Google Generative AI** — `gemini-2.5-flash`, server-side only via `server/services/aiService.ts`
- **Nitro** — server API routes under `server/api/`
- **vuedraggable 4** — drag-and-drop routine item reordering in `routines/[id].vue`

## Architecture

### Auth pattern
Every server API endpoint calls `serverSupabaseUser(event)` and throws 401 if not logged in. There is no global middleware — auth is checked per-endpoint. Guest mode is explicitly supported on the analyze page (no auth required).

Two Supabase clients exist:
- `serverSupabaseClient(event)` — user-scoped, respects RLS, used for most queries
- `NUXT_SUPABASE_SECRET_KEY` service key — used when admin-level access is needed

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
- PUT only updates `product_name` and `product_category`

### Routine generation
AI routine generation uses a 180 s timeout (vs 60 s default) — Gemini can be slow. Timeout errors are detected in `useCreateRoutine.ts` and shown with a specific UX message.

### Category normalization
Always use `normalizeProductCategory()` from `~/utils/productCategories` when reading/writing `product_category`. It maps Chinese aliases and English names (e.g. `serum` → `精華液`) to one of 8 canonical values. This runs on both client and server.

### State management scope
Pinia (`stores/useUserProfile.ts`) is only used for the user profile — shared across pages. Cabinet products and routines use composables (`useCabinet.ts`, `useCreateRoutine.ts`) with direct `$fetch` calls; no global store for them.

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

## Database tables

| Table | Notes |
|-------|-------|
| `profiles` | User skin type, age, gender, issues |
| `user_cabinet` | User products; `raw_ingredients` NOT NULL; `analysis_result` JSONB |
| `official_ingredients` | Global ingredient warnings + `skin_type_risks` JSONB |
| `cosmetic_regulations` | TFDA Taiwan-specific rules |
| `routines` | Routine metadata; `is_active` flag (only one active at a time) |
| `routine_items` | `is_locked = true` items are skipped during AI regeneration |

## Environment variables

```
SUPABASE_URL
SUPABASE_ANON_KEY
NUXT_SUPABASE_SECRET_KEY   # Service role key — server only
GEMINI_API_KEY             # Server only (set in runtimeConfig.geminiApiKey)
```
