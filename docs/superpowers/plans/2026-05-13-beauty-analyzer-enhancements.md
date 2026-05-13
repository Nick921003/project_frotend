# Beauty Analyzer 8 大功能強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 Beauty Analyzer 新增 8 個功能，分兩批執行：批次 A 不需 DB migration（Task 1-4、6），批次 B 需先跑 Supabase SQL（Task 5、7、8）。

---

## ⚠️ 已知坑（2026-05-13 實測後補充）

> 執行 Task 1、4、6 前**必讀**，否則功能表面實作正確但實際無效。

### 坑 1：`routine_items.product_id` 幾乎都是 NULL

**根本原因有三層：**

1. **AI 生成排程時**（`create.post.ts`）：用 `normalizeName` 做名稱比對，若 AI 回傳名稱與保養品櫃名稱有任何差異（全/半形、多空格），`nameToId.get()` 會 miss，`product_id` 存成 `null`。
2. **手動拖拽 / 快速新增**（`useRoutineDragDrop.ts`）：建立 `newItem` 時原本**完全沒有** `product_id` 欄位 → 已修正，現在帶 `product.id`。
3. **儲存排程**（`update-order.post.ts`）：`update` 和 `insert` 的欄位清單原本**沒有** `product_id` → 已修正，現在帶入。

**影響範圍：** Task 1（孤兒標示）、Task 4（成分分析展開）、Task 6（衝突偵測）全部依賴 `product_id` 不為 null。

**解決方式：**
- 上述兩個前端/後端檔案已修正，**新建立的排程**才有效。
- **舊有排程的 items** `product_id` 仍為 null，需使用者手動重新儲存一次（拖拽任意步驟後按「儲存」），或刪除舊排程重新生成。

---

### 坑 2：Task 2 改名同步 — `product_id` 為 null 的 items 不會被同步

**根本原因：** 原本只用 `.eq('product_id', productId)` 更新，但若 items 的 `product_id` 是 null，根本找不到。

**已修正：** `cabinet/[id].put.ts` 改為雙重同步：
1. `by product_id`：更新有 `product_id` 的 items
2. `by user_id + 舊名稱 + product_id IS NULL`：fallback，更新靠名稱比對的 items

---

### 坑 3：Task 4 成分分析展開 — 無警告時顯示空白

**根本原因：** 原 template 只有 `regulatoryAlerts` 和 `skinTypeAlerts` 兩個 `v-if`，兩者都空時什麼都不渲染。

**已修正：** 加入 fallback `<template>` 顯示「✅ 無警告成分」；`<summary>` 文字從「成分警告」改為「成分分析」（語意更準確）。

---

### 坑 4：Task 3 前端位置錯誤

**計劃指定** `pages/index.vue`，但保養品列表實際在 `pages/beauty-plan.vue`。
**已實作於** `beauty-plan.vue`，功能正確，計劃描述有誤。

---

### 坑 5：推薦理由（`recommendation_reason`）有存但不顯示

`create.post.ts` 有存 `recommendation_reason` 到 DB，但 `useRoutineRecommendations.ts` 的 `unifiedRecommendations` 只萃取成分關鍵字，原因字串被丟棄。`RoutineRecommendations.vue` 也沒有顯示。

**已修正：** `UnifiedRecommendation` 新增 `reason` 欄位，Vue 顯示斜體小字。

---

**Architecture:** 後端均為 Nuxt Nitro server routes（`server/api/`）。前端以 Vue 3 Composition API 撰寫，排程相關 UI 集中在 `components/routine/RoutineDayPanel.vue`，分析頁在 `pages/index.vue`，個人資料頁在 `pages/profile.vue`。所有 DB 操作都走 `serverSupabaseClient(event)`（RLS 範圍）。

**Tech Stack:** Nuxt 4、Vue 3、Supabase PostgreSQL、TypeScript

---

## 總覽：哪些檔案會動到

| Task | 功能 | 主要改動檔案 |
|------|------|------------|
| 1 | 孤兒標示 | `server/api/routines/[id].get.ts`、`components/routine/RoutineDayPanel.vue` |
| 2 | 改名同步 | `server/api/cabinet/[id].put.ts` |
| 3 | 排程使用計數 | `server/api/cabinet/list.get.ts`、`pages/index.vue` |
| 4 | 步驟顯示成分警告 | `components/routine/RoutineDayPanel.vue` |
| 5 | 安全提示靜音 | Supabase SQL、`server/api/profile/get.ts`、`update.post.ts`、`pages/profile.vue`、`pages/index.vue` |
| 6 | 成分衝突偵測 | `server/utils/ingredientConflicts.ts`（新增）、`server/api/routines/[id].get.ts` |
| 7 | 打卡功能 | Supabase SQL、`server/api/routines/checkins/toggle.post.ts`（新增）、`server/api/routines/[id]/checkins.get.ts`（新增）、`RoutineDayPanel.vue` |
| 8 | 效期追蹤 | Supabase SQL、`server/api/cabinet/[id].put.ts`、`list.get.ts`、`pages/products/[id]/edit.vue`、`pages/index.vue` |

---

## ── 批次 A：不需 DB migration ──

---

### Task 1：排程孤兒標示

**效果：** 如果排程中某個步驟的產品已從保養品櫃刪除，該步驟會顯示「產品已刪除」的紅色警告，讓使用者知道要清理或補回。

**原理：** `routine_items.product_id` 現在有值。查完 items 後，再查一次哪些 product_id 還在 user_cabinet，沒找到的就標為孤兒。

---

- [ ] **Step 1：修改 `server/api/routines/[id].get.ts`，在 items 上加 `is_orphan` 旗標**

在查完 `routine_items` 之後（第 53-65 行），加入以下邏輯，放在「查詢該用戶的所有產品」之前：

```typescript
// 找出哪些 product_id 還存在於 user_cabinet
const productIdsInItems = (itemsData || [])
  .map((i: any) => i.product_id)
  .filter(Boolean) as string[];

let existingProductIds = new Set<string>();
if (productIdsInItems.length > 0) {
  const { data: existingProds } = await (supabase as any)
    .from('user_cabinet')
    .select('id')
    .in('id', productIdsInItems);
  existingProductIds = new Set((existingProds || []).map((p: any) => p.id));
}

// 將 is_orphan 旗標附加到 items
const itemsWithOrphan = (itemsData || []).map((item: any) => ({
  ...item,
  is_orphan: item.product_id != null && !existingProductIds.has(item.product_id)
}));
```

將 `return` 中的 `items: itemsData || []` 改為 `items: itemsWithOrphan`。

- [ ] **Step 2：修改 `components/routine/RoutineDayPanel.vue`，顯示孤兒 badge**

找到 `<div class="item-content">` 的區塊（第 54-57 行附近），在 `<span class="name">` 後面加上：

```html
<span v-if="item.is_orphan" class="badge-orphan">產品已刪除</span>
```

在 `<style>` 區塊加入：

```css
.badge-orphan {
  font-size: 11px;
  color: var(--color-critical);
  border: 1px solid var(--color-critical);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  margin-left: var(--space-sm);
}
```

- [ ] **Step 3：手動驗證**

1. 在保養品櫃新增一個產品 A → 生成排程（A 會進入排程）
2. 從保養品櫃刪除產品 A
3. 重新整理排程頁 → 產品 A 的步驟應出現「產品已刪除」紅色標籤

- [ ] **Step 4：Commit**

```bash
git add server/api/routines/[id].get.ts components/routine/RoutineDayPanel.vue
git commit -m "feat: 排程項目顯示「產品已刪除」孤兒標示"
```

---

### Task 2：改名同步

**效果：** 在保養品編輯頁修改產品名稱後，所有排程中對應到這個產品的步驟名稱也會自動更新，不需要重新生成排程。

**原理：** 產品 PUT 時，用 `product_id` 去 UPDATE `routine_items.product_name`。

---

- [ ] **Step 1：修改 `server/api/cabinet/[id].put.ts`，在 update 後同步 routine_items**

在第 56-63 行的 `supabase.update(...)` 之後（取得 `data` 成功後），加入：

```typescript
// 同步所有排程中此產品的名稱
const { error: syncError } = await (supabase as any)
  .from('routine_items')
  .update({ product_name })
  .eq('product_id', productId);

if (syncError) {
  // 不中斷主流程，僅記 warning
  console.warn('[Cabinet PUT] routine_items 改名同步失敗:', syncError.message);
}
```

- [ ] **Step 2：手動驗證**

1. 建立排程，確認產品 A 在排程中
2. 進入產品 A 編輯頁，把名稱改為「產品 A (改名測試)」
3. 開啟排程頁 → 步驟名稱應已更新

- [ ] **Step 3：Commit**

```bash
git add server/api/cabinet/[id].put.ts
git commit -m "feat: 改名保養品時自動同步排程步驟名稱"
```

---

### Task 3：保養品卡顯示「已在幾個排程使用」

**效果：** 在首頁（保養品列表）的每張產品卡上，顯示這個產品被幾個排程使用，例如「排程中 ×2」，讓使用者一眼看到哪些產品是主力。

**原理：** `cabinet/list.get.ts` 查完產品後，對每個 product_id 去 `routine_items` 計算出現次數。用一次批次查詢，不做 N+1。

---

- [ ] **Step 1：修改 `server/api/cabinet/list.get.ts`，附加 `routine_usage_count`**

在 `return { success: true, ... }` 之前，加入以下批次查詢：

```typescript
// 批次查詢每個產品在 routine_items 中被使用的 distinct routine 數量
const productIds = (data || []).map((p: any) => p.id);
let usageMap = new Map<string, number>();

if (productIds.length > 0) {
  const { data: usageData } = await (supabase as any)
    .from('routine_items')
    .select('product_id, routine_id')
    .in('product_id', productIds)
    .eq('is_recommendation', false);

  // 計算每個 product_id 出現在幾個不同的 routine
  for (const row of (usageData || [])) {
    if (!row.product_id) continue;
    usageMap.set(row.product_id, (usageMap.get(row.product_id) || 0) + 1);
  }
}

// 附加到每筆產品
const enrichedData = (data || []).map((p: any) => ({
  ...p,
  routine_usage_count: usageMap.get(p.id) || 0
}));
```

將 `return` 中 `data` 改為 `enrichedData`。

- [ ] **Step 2：修改 `pages/index.vue`，在產品卡顯示計數**

找到 cabinet 產品列表的卡片模板區域（搜尋 `product_name`），在產品名稱下方加入：

```html
<span
  v-if="product.routine_usage_count > 0"
  class="routine-usage-badge"
>排程中 ×{{ product.routine_usage_count }}</span>
```

在 `<style>` 加入：

```css
.routine-usage-badge {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
}
```

- [ ] **Step 3：手動驗證**

產品 A 在排程中使用 → 首頁產品卡顯示「排程中 ×N」。未在排程的產品不顯示。

- [ ] **Step 4：Commit**

```bash
git add server/api/cabinet/list.get.ts pages/index.vue
git commit -m "feat: 保養品卡顯示排程使用計數"
```

---

### Task 4：排程步驟顯示成分警告

**效果：** 在排程頁每個步驟旁邊，可以展開看到這個產品的成分警告（法規或膚質警告）。讓使用者不用跳回分析頁就能快速確認。

**原理：** `GET /api/routines/[id]` 回傳的 `all_products` 已含 `analysis_result`（JSONB）。前端只需用 `product_id` 建立查找表，展開時顯示警告。

**注意：** 此 Task 純前端，不需改後端。

---

- [ ] **Step 1：修改 `pages/routines/[id].vue`，將 `all_products` 建成 productId → analysis map，傳給 RoutineDayPanel**

在 `<script setup>` 中，找到 routine 資料處理區（通常在 `watchEffect` 或 `onMounted` 附近），加入：

```typescript
// productId → { regulatoryAlerts, skinTypeAlerts } 的快查表
const productAnalysisMap = computed(() => {
  const map = new Map<string, any>();
  for (const p of (routine.value?.all_products || [])) {
    if (p.id && p.analysis_result?.analysis) {
      map.set(p.id, p.analysis_result.analysis);
    }
  }
  return map;
});
```

在 `<RoutineDayPanel>` 元件上加 prop：

```html
:product-analysis-map="productAnalysisMap"
```

- [ ] **Step 2：修改 `components/routine/RoutineDayPanel.vue`，接收 prop 並展開顯示**

在 `defineProps` 加入：

```typescript
productAnalysisMap: {
  type: Map as PropType<Map<string, any>>,
  default: () => new Map()
}
```

在每個 `scheduled-item` 的 `<div class="item-content">` 之後加上展開區塊：

```html
<template v-if="item.product_id && productAnalysisMap.get(item.product_id)">
  <details class="item-analysis">
    <summary class="item-analysis__toggle">成分警告</summary>
    <div class="item-analysis__body">
      <template v-if="productAnalysisMap.get(item.product_id)?.regulatoryAlerts?.length">
        <p class="alert-label alert-label--red">🔴 法規警告</p>
        <ul>
          <li v-for="a in productAnalysisMap.get(item.product_id).regulatoryAlerts" :key="a.inci_name">
            {{ a.inci_name }}
          </li>
        </ul>
      </template>
      <template v-if="productAnalysisMap.get(item.product_id)?.skinTypeAlerts?.length">
        <p class="alert-label alert-label--yellow">🟡 膚質地雷</p>
        <ul>
          <li v-for="a in productAnalysisMap.get(item.product_id).skinTypeAlerts" :key="a.inci_name">
            {{ a.inci_name }}
          </li>
        </ul>
      </template>
    </div>
  </details>
</template>
```

在 `<style>` 加入：

```css
.item-analysis { margin-top: var(--space-xs); }
.item-analysis__toggle { font-size: 11px; color: var(--color-text-muted); cursor: pointer; }
.item-analysis__body { font-size: 12px; padding: var(--space-xs) 0; }
.alert-label { font-size: 11px; font-weight: 600; margin: 4px 0 2px; }
.alert-label--red { color: var(--color-critical); }
.alert-label--yellow { color: var(--color-amber); }
.item-analysis ul { margin: 0; padding-left: 16px; }
```

- [ ] **Step 3：手動驗證**

進入排程頁 → 點開某個有分析結果的步驟 → 應顯示「成分警告」可展開連結 → 展開後列出警告成分。

- [ ] **Step 4：Commit**

```bash
git add pages/routines/[id].vue components/routine/RoutineDayPanel.vue
git commit -m "feat: 排程步驟可展開查看成分警告"
```

---

### Task 6：成分衝突偵測

**效果：** 當同一天的排程中，早晨和晚間同時使用了不建議搭配的成分組合（如酸類＋A醇），在該日的標題旁顯示橘色衝突警告。

**衝突規則（初版）：**
| 組合 | 說明 |
|------|------|
| 酸類（AHA/BHA）+ A醇（Retinol） | 同一時段可能過度刺激 |
| 高濃度 Vitamin C + 酸類 | pH 衝突，效果互相抵消 |

---

- [ ] **Step 1：新增 `server/utils/ingredientConflicts.ts`**

```typescript
// 成分衝突偵測工具

type ConflictRule = {
  name: string;
  groupA: string[];  // 關鍵字清單（lowercase）
  groupB: string[];
  message: string;
};

const CONFLICT_RULES: ConflictRule[] = [
  {
    name: 'acid_retinol',
    groupA: ['glycolic acid', 'lactic acid', 'salicylic acid', 'mandelic acid', 'aha', 'bha', 'citric acid'],
    groupB: ['retinol', 'retinal', 'retinaldehyde', 'tretinoin', 'retinoic acid'],
    message: '酸類 + A醇同天使用可能過度刺激，建議分開早晚或隔天輪用'
  },
  {
    name: 'vitaminc_acid',
    groupA: ['ascorbic acid', 'l-ascorbic acid', 'vitamin c'],
    groupB: ['glycolic acid', 'lactic acid', 'salicylic acid', 'aha', 'bha'],
    message: 'Vitamin C + 酸類 pH 不相容，同時使用可能降低效果'
  }
];

export type ConflictWarning = {
  rule: string;
  message: string;
};

/**
 * 傳入某一天所有步驟的成分清單，回傳衝突警告。
 * ingredients 是二維陣列：每個 item 的 string[] 成分。
 */
export function detectConflicts(allIngredients: string[][]): ConflictWarning[] {
  const flat = allIngredients.flat().map(s => s.toLowerCase());
  const warnings: ConflictWarning[] = [];

  for (const rule of CONFLICT_RULES) {
    const hasA = rule.groupA.some(k => flat.some(i => i.includes(k)));
    const hasB = rule.groupB.some(k => flat.some(i => i.includes(k)));
    if (hasA && hasB) {
      warnings.push({ rule: rule.name, message: rule.message });
    }
  }

  return warnings;
}
```

- [ ] **Step 2：修改 `server/api/routines/[id].get.ts`，計算每天衝突後附加到 response**

在 `return` 之前，import 並計算：

```typescript
import { detectConflicts } from '~/server/utils/ingredientConflicts';

// 計算各天的成分衝突
const conflictsByDay: Record<number, { rule: string; message: string }[]> = {};
for (let day = 0; day < 7; day++) {
  const dayItems = (itemsWithOrphan).filter((i: any) => i.day_of_week === day);
  const allIngredients = dayItems
    .map((i: any) => Array.isArray(i.ingredients) ? i.ingredients : [])
    .filter((arr: string[]) => arr.length > 0);
  const warnings = detectConflicts(allIngredients);
  if (warnings.length > 0) conflictsByDay[day] = warnings;
}
```

在 `return` 的 `data` 物件加入 `conflicts_by_day: conflictsByDay`。

- [ ] **Step 3：修改 `components/routine/RoutineDayPanel.vue`，在天標籤顯示衝突警告**

在 `defineProps` 加入：

```typescript
conflictsByDay: {
  type: Object as PropType<Record<number, { rule: string; message: string }[]>>,
  default: () => ({})
}
```

在 `pages/routines/[id].vue` 的 `<RoutineDayPanel>` 傳入：

```html
:conflicts-by-day="routine.conflicts_by_day || {}"
```

在 `RoutineDayPanel.vue` 的日期標籤列，在 `<span class="tab-count">` 後加入：

```html
<span
  v-if="conflictsByDay[dayIdx]?.length"
  class="tab-conflict"
  :title="conflictsByDay[dayIdx].map(c => c.message).join('\n')"
>⚠</span>
```

在日期內容區頂部（`<div class="day-view">` 之後）加入：

```html
<div
  v-if="conflictsByDay[expandedDayIdx]?.length"
  class="conflict-banner"
>
  <strong>⚠ 成分搭配提示</strong>
  <ul>
    <li
      v-for="c in conflictsByDay[expandedDayIdx]"
      :key="c.rule"
    >{{ c.message }}</li>
  </ul>
</div>
```

在 `<style>` 加入：

```css
.tab-conflict { font-size: 11px; color: var(--color-amber); margin-left: 2px; }
.conflict-banner {
  background: #FFF8EE;
  border: 1px solid var(--color-amber);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  margin-bottom: var(--space-md);
  font-size: 13px;
  color: var(--color-text-primary);
}
.conflict-banner ul { margin: 4px 0 0; padding-left: 16px; }
```

- [ ] **Step 4：手動驗證**

在排程同一天放入含 Glycolic Acid 的產品（早晨）和含 Retinol 的產品（晚間）→ 該日的標籤出現 ⚠ → 點入該天看到橘色提示框。

- [ ] **Step 5：Commit**

```bash
git add server/utils/ingredientConflicts.ts server/api/routines/[id].get.ts components/routine/RoutineDayPanel.vue pages/routines/[id].vue
git commit -m "feat: 排程成分衝突偵測（酸類+A醇、VC+酸類）"
```

---

## ── 批次 B：需先在 Supabase 執行 SQL ──

> 以下三個 task 都需要先在 Supabase Dashboard → SQL Editor 執行 migration，再改程式碼。

---

### Task 5：安全提示靜音（進階使用者模式）

**效果：** 在個人資料頁有一個「進階模式」開關。開啟後，分析頁的「膚質地雷」（黃色警告）會隱藏，但法規禁用成分（紅色）永遠顯示。適合熟悉成分的老手或油肌使用者。

---

- [ ] **Step 1：Supabase SQL — 新增欄位**

在 Supabase Dashboard → SQL Editor 執行：

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS suppress_safety_warnings BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2：修改 `server/api/profile/get.ts`，回傳新欄位**

將 `.select(...)` 的欄位清單加上 `suppress_safety_warnings`：

```typescript
.select('id, base_skin_type, age_group, gender, birth_year, issues, suppress_safety_warnings, created_at, updated_at')
```

在 `return` 的 `data` 物件加上：

```typescript
suppress_safety_warnings: data.suppress_safety_warnings ?? false,
```

- [ ] **Step 3：修改 `server/api/profile/update.post.ts`，處理新欄位**

在取得 body 的地方加上：

```typescript
const suppressSafetyWarnings = body.suppress_safety_warnings;
```

在 `if (suppressSafetyWarnings !== undefined)` 區塊加入（仿照其他欄位的 pattern）：

```typescript
if (suppressSafetyWarnings !== undefined) {
  updateData.suppress_safety_warnings = Boolean(suppressSafetyWarnings);
}
```

同樣在 `insertData` 區塊加上相同判斷。

- [ ] **Step 4：修改 `pages/profile.vue`，加入開關**

在 `formData` 的 reactive 物件加上：

```typescript
suppress_safety_warnings: false
```

在 profile get 的地方，將值映射進來：

```typescript
formData.suppress_safety_warnings = profileData.suppress_safety_warnings ?? false;
```

在表單的「儲存修改」按鈕上方加入開關 UI：

```html
<div class="form-group">
  <label class="form-label">進階使用者模式</label>
  <p class="hint-text">開啟後，分析頁的「膚質地雷」提示將隱藏。法規禁用成分警告不受影響。</p>
  <label class="toggle-switch">
    <input
      type="checkbox"
      v-model="formData.suppress_safety_warnings"
    />
    <span class="toggle-track">
      <span class="toggle-thumb"></span>
    </span>
    <span class="toggle-label">{{ formData.suppress_safety_warnings ? '已開啟（隱藏膚質提示）' : '關閉（顯示所有警告）' }}</span>
  </label>
</div>
```

在 `<style>` 加入（簡單 toggle）：

```css
.toggle-switch { display: flex; align-items: center; gap: var(--space-sm); cursor: pointer; }
.toggle-switch input { display: none; }
.toggle-track {
  width: 40px; height: 22px;
  background: var(--color-border);
  border-radius: 11px;
  position: relative;
  transition: background 0.2s;
}
.toggle-switch input:checked ~ .toggle-track { background: var(--color-sage); }
.toggle-thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 16px; height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: left 0.2s;
}
.toggle-switch input:checked ~ .toggle-track .toggle-thumb { left: 21px; }
.toggle-label { font-size: 13px; color: var(--color-text-secondary); }
```

在 `handleSubmit` 送出時，加上 `suppress_safety_warnings: formData.suppress_safety_warnings`。

- [ ] **Step 5：修改 `pages/index.vue`，讀取設定後條件顯示膚質警告**

在 `<script setup>` 加入：

```typescript
const { data: profileResp } = await useFetch('/api/profile/get');
const suppressWarnings = computed(() =>
  profileResp.value?.data?.suppress_safety_warnings === true
);
```

找到 `skinTypeAlerts` 的顯示區塊（`v-if="result.data.analysis.skinTypeAlerts.length > 0"`），加上條件：

```html
<div
  v-if="!suppressWarnings && result.data.analysis.skinTypeAlerts.length > 0"
  class="alert-block alert-yellow"
>
```

- [ ] **Step 6：手動驗證**

1. 分析頁對含膚質地雷成分的產品分析 → 應看到黃色「膚質地雷」區塊
2. 進個人資料頁開啟「進階模式」→ 儲存
3. 再次分析同一產品 → 黃色區塊消失，紅色法規警告仍在

- [ ] **Step 7：Commit**

```bash
git add server/api/profile/get.ts server/api/profile/update.post.ts pages/profile.vue pages/index.vue
git commit -m "feat: 個人資料新增進階模式，可靜音膚質地雷提示"
```

---

### Task 7：打卡功能

**效果：** 在排程頁每個步驟旁邊有一個勾勾按鈕，使用者每天可以標記「今天已完成這個步驟」。打卡記錄按日期儲存，可追蹤每週執行率。

---

- [ ] **Step 1：Supabase SQL — 建立打卡表**

```sql
CREATE TABLE IF NOT EXISTS routine_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_item_id UUID NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
  checked_date  DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (routine_item_id, checked_date)
);

ALTER TABLE routine_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own checkins"
ON routine_checkins
FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 2：新增 `server/api/routines/checkins/toggle.post.ts`**

```typescript
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
  const userId = user.id || user.sub;

  const { routine_item_id, checked_date } = await readBody(event);
  if (!routine_item_id || !checked_date) {
    throw createError({ statusCode: 400, statusMessage: '缺少 routine_item_id 或 checked_date' });
  }

  const supabase = await serverSupabaseClient(event);

  // 查詢是否已打卡
  const { data: existing } = await (supabase as any)
    .from('routine_checkins')
    .select('id')
    .eq('routine_item_id', routine_item_id)
    .eq('checked_date', checked_date)
    .single();

  if (existing) {
    // 已打卡 → 取消
    await (supabase as any)
      .from('routine_checkins')
      .delete()
      .eq('id', existing.id);
    return { success: true, checked: false };
  } else {
    // 未打卡 → 新增
    await (supabase as any)
      .from('routine_checkins')
      .insert({ user_id: userId, routine_item_id, checked_date });
    return { success: true, checked: true };
  }
});
```

- [ ] **Step 3：新增 `server/api/routines/[id]/checkins.get.ts`**

```typescript
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
  const userId = user.id || user.sub;

  const routineId = getRouterParam(event, 'id');
  const query = getQuery(event);
  const date = String(query.date || new Date().toISOString().slice(0, 10));

  const supabase = await serverSupabaseClient(event);

  // 取得此 routine 今天的所有打卡
  const { data } = await (supabase as any)
    .from('routine_checkins')
    .select('routine_item_id')
    .eq('user_id', userId)
    .eq('checked_date', date)
    .in(
      'routine_item_id',
      (await (supabase as any)
        .from('routine_items')
        .select('id')
        .eq('routine_id', routineId)).data?.map((i: any) => i.id) || []
    );

  const checkedIds = new Set((data || []).map((c: any) => c.routine_item_id));
  return { success: true, data: { checked_ids: Array.from(checkedIds), date } };
});
```

- [ ] **Step 4：修改 `components/routine/RoutineDayPanel.vue`，加入打卡按鈕**

在 `defineProps` 加入：

```typescript
checkedItemIds: {
  type: Set as unknown as PropType<Set<string>>,
  default: () => new Set<string>()
}
```

在 `defineEmits` 加入：

```typescript
'toggle-checkin': [itemId: string]
```

在每個步驟的按鈕列（鎖定按鈕旁）加入：

```html
<button
  v-if="item.id"
  @click="$emit('toggle-checkin', item.id)"
  class="btn-checkin"
  :class="{ 'is-checked': checkedItemIds.has(item.id) }"
  title="今日打卡"
>{{ checkedItemIds.has(item.id) ? '✅' : '⬜' }}</button>
```

在 `pages/routines/[id].vue` 的 `<script setup>` 加入：

```typescript
const today = new Date().toISOString().slice(0, 10);
const checkedItemIds = ref(new Set<string>());

// 載入今天打卡狀態
const loadCheckins = async () => {
  if (!routineId) return;
  const { data } = await $fetch<any>(`/api/routines/${routineId}/checkins`, {
    query: { date: today }
  });
  checkedItemIds.value = new Set(data.checked_ids);
};

onMounted(loadCheckins);

const handleToggleCheckin = async (itemId: string) => {
  const { checked } = await $fetch<any>('/api/routines/checkins/toggle', {
    method: 'POST',
    body: { routine_item_id: itemId, checked_date: today }
  });
  if (checked) {
    checkedItemIds.value.add(itemId);
  } else {
    checkedItemIds.value.delete(itemId);
  }
  checkedItemIds.value = new Set(checkedItemIds.value); // 觸發 reactivity
};
```

在 `<RoutineDayPanel>` 傳入：

```html
:checked-item-ids="checkedItemIds"
@toggle-checkin="handleToggleCheckin"
```

在 `<style>` 加入：

```css
.btn-checkin { background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px 4px; }
.btn-checkin.is-checked { opacity: 1; }
```

- [ ] **Step 5：手動驗證**

1. 進排程頁 → 點步驟旁的 ⬜ → 變成 ✅
2. 重新整理頁面 → ✅ 持續顯示（今天已打卡）
3. 再點一次 ✅ → 取消打卡，變回 ⬜

- [ ] **Step 6：Commit**

```bash
git add server/api/routines/checkins/toggle.post.ts server/api/routines/[id]/checkins.get.ts components/routine/RoutineDayPanel.vue pages/routines/[id].vue
git commit -m "feat: 排程步驟每日打卡功能"
```

---

### Task 8：產品效期追蹤

**效果：** 在產品編輯頁可以填入「開封日期」，系統根據產品類型自動推算到期日（也可手動調整）。首頁產品卡顯示「X 天後到期」或「已過期」警告，提醒使用者更換。

**PAO 預設（開封後建議使用期限）：**
| 類別 | 預設月數 |
|------|---------|
| 精華液 | 6 個月 |
| 乳液/乳霜/面霜 | 12 個月 |
| 防曬 | 12 個月 |
| 去角質 | 6 個月 |
| 眼霜 | 6 個月 |
| 其他 | 12 個月 |

---

- [ ] **Step 1：Supabase SQL — 新增欄位**

```sql
ALTER TABLE user_cabinet
ADD COLUMN IF NOT EXISTS opened_at DATE,
ADD COLUMN IF NOT EXISTS expires_at DATE;
```

- [ ] **Step 2：修改 `server/api/cabinet/[id].put.ts`，接受並儲存新欄位**

在取得 body 的地方加上：

```typescript
const { product_name, product_category, opened_at, expires_at } = body;
```

在 `supabase.update(...)` 的物件加入：

```typescript
...(opened_at !== undefined && { opened_at: opened_at || null }),
...(expires_at !== undefined && { expires_at: expires_at || null }),
```

- [ ] **Step 3：修改 `server/api/cabinet/list.get.ts`，加上 `expiry_status` 欄位**

在 `enrichedData` 的 map 中加入：

```typescript
expiry_status: getExpiryStatus(p.expires_at),
```

在檔案頂部加入輔助函數：

```typescript
function getExpiryStatus(expiresAt: string | null): 'ok' | 'soon' | 'expired' | null {
  if (!expiresAt) return null;
  const today = new Date();
  const exp = new Date(expiresAt);
  const diffDays = Math.floor((exp.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'soon';
  return 'ok';
}
```

- [ ] **Step 4：修改 `pages/products/[id]/edit.vue`，加入日期欄位**

找到表單欄位區（product_name、product_category 附近），加入：

```html
<div class="form-group">
  <label class="form-label">開封日期</label>
  <input type="date" v-model="form.opened_at" class="form-input" @change="autoCalcExpiry" />
</div>
<div class="form-group">
  <label class="form-label">預估到期日</label>
  <p class="hint-text">依類別自動推算，可手動調整</p>
  <input type="date" v-model="form.expires_at" class="form-input" />
</div>
```

在 `<script setup>` 加入自動計算函數：

```typescript
const PAO_MONTHS: Record<string, number> = {
  '精華液': 6, '眼霜': 6, '去角質': 6,
  '乳液': 12, '乳霜': 12, '面霜': 12, '防曬': 12
};

const autoCalcExpiry = () => {
  if (!form.value.opened_at || !form.value.product_category) return;
  const months = PAO_MONTHS[form.value.product_category] ?? 12;
  const opened = new Date(form.value.opened_at);
  opened.setMonth(opened.getMonth() + months);
  form.value.expires_at = opened.toISOString().slice(0, 10);
};
```

在 `form` 的 reactive 物件中加上 `opened_at: ''` 和 `expires_at: ''`，並在 load 產品資料時填入。

在送出 PUT 的 body 加上 `opened_at: form.value.opened_at || null, expires_at: form.value.expires_at || null`。

- [ ] **Step 5：修改 `pages/index.vue`，在產品卡顯示效期警告**

找到產品卡列表，在 `.routine-usage-badge` 旁加入：

```html
<span
  v-if="product.expiry_status === 'expired'"
  class="expiry-badge expiry-badge--expired"
>已過期</span>
<span
  v-else-if="product.expiry_status === 'soon'"
  class="expiry-badge expiry-badge--soon"
>快到期</span>
```

在 `<style>` 加入：

```css
.expiry-badge { font-size: 11px; border-radius: var(--radius-sm); padding: 1px 6px; }
.expiry-badge--expired { color: var(--color-critical); border: 1px solid var(--color-critical); }
.expiry-badge--soon { color: var(--color-rose); border: 1px solid var(--color-rose); }
```

- [ ] **Step 6：手動驗證**

1. 進產品編輯頁，填入今天的開封日期 → 到期日自動計算
2. 儲存後回首頁 → 產品卡不顯示警告（還沒到期）
3. 手動把 expires_at 改為今天之前的日期 → 產品卡顯示「已過期」

- [ ] **Step 7：Commit**

```bash
git add server/api/cabinet/[id].put.ts server/api/cabinet/list.get.ts pages/products/[id]/edit.vue pages/index.vue
git commit -m "feat: 產品效期追蹤，開封日自動推算到期日並在卡片顯示警告"
```

---

## 完成後 Push

```bash
git push origin main
```

---

## 執行順序建議

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 6  （批次 A，無需 SQL）
↓
Task 5 → Task 7 → Task 8                      （批次 B，先跑 Supabase SQL）
```
