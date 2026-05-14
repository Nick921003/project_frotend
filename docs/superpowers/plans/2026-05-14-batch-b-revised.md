# 批次 B 修訂版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作 Task 5（安全提示靜音）、Task 7（每日打卡）、Task 8（效期追蹤），三個功能均依賴 Supabase SQL migration。

**Architecture:** 後端為 Nuxt Nitro server routes（`server/api/`）。`profiles` 相關操作走 Pinia store（`stores/useUserProfile.ts`）—— 不在頁面額外 `$fetch`。DB 操作均用 `serverSupabaseClient(event)`（RLS）。Cabinet 產品卡在 `pages/beauty-plan.vue`，非 `pages/index.vue`。

**Tech Stack:** Nuxt 4、Vue 3 Composition API、Supabase PostgreSQL、Pinia、TypeScript

---

## 改動檔案總覽

| Task | 新增 | 修改 |
|------|------|------|
| T5 | — | `stores/useUserProfile.ts`、`server/api/profile/get.ts`、`server/api/profile/update.post.ts`、`pages/profile.vue`、`pages/index.vue` |
| T7 | `server/api/routines/checkins/toggle.post.ts`、`server/api/routines/[id]/checkins.get.ts` | `components/routine/RoutineDayPanel.vue`、`pages/routines/[id].vue` |
| T8 | — | `server/api/cabinet/[id].put.ts`、`server/api/cabinet/list.get.ts`、`pages/products/[id]/edit.vue`、`pages/beauty-plan.vue` |
| T9 | `pages/routines/active.vue` | `app.vue` |

---

## ── 需先在 Supabase 執行的 SQL（三個 Task 全部）──

在 Supabase Dashboard → SQL Editor 依序執行：

```sql
-- Task 5
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS suppress_safety_warnings BOOLEAN NOT NULL DEFAULT FALSE;

-- Task 7
CREATE TABLE IF NOT EXISTS routine_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_item_id UUID NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
  checked_date    DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (routine_item_id, checked_date)
);
ALTER TABLE routine_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own checkins"
  ON routine_checkins FOR ALL USING (auth.uid() = user_id);

-- Task 8
ALTER TABLE user_cabinet
ADD COLUMN IF NOT EXISTS expires_at DATE;
```

---

## Task 5：安全提示靜音

**效果：** `pages/profile.vue` 新增「進階模式」toggle。開啟後，`pages/index.vue` 的「膚質地雷」黃色區塊隱藏；法規紅色警告永遠顯示。

**重要：** `profile.vue` 用 Pinia store（`useUserProfile`），不直接 `$fetch`。`index.vue` 讀 store 資料，不另打 API。

---

- [ ] **Step 1：更新 `stores/useUserProfile.ts`，`UserProfile` 加入新欄位**

在 `stores/useUserProfile.ts` 的 `UserProfile` interface（第 7 行），加入：

```typescript
export interface UserProfile {
  id: string;
  base_skin_type: string;
  age_group: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birth_year: number | null;
  issues: string | null;
  suppress_safety_warnings: boolean;   // ← 新增
  created_at: string;
  updated_at: string;
}
```

在 `updateUserProfile` 的參數型別（第 91 行附近）加入：

```typescript
const updateUserProfile = async (data: {
  base_skin_type?: string;
  age_group?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  issues?: string | null;
  birth_year?: number | null;
  suppress_safety_warnings?: boolean;   // ← 新增
}) => {
```

- [ ] **Step 2：修改 `server/api/profile/get.ts`，SELECT 加入新欄位並回傳**

第 27 行的 `.select(...)` 改為：

```typescript
.select('id, base_skin_type, age_group, gender, birth_year, issues, suppress_safety_warnings, created_at, updated_at')
```

第 51 行的 return data 物件加入：

```typescript
suppress_safety_warnings: data.suppress_safety_warnings ?? false,
```

- [ ] **Step 3：修改 `server/api/profile/update.post.ts`，接受並儲存新欄位**

在第 25 行（其他欄位宣告後）加入：

```typescript
const suppressSafetyWarnings = body.suppress_safety_warnings;
```

第 27 行的 `hasAnyField` 判斷加入此欄位：

```typescript
const hasAnyField = [skinType, ageGroup, gender, issues, birthYear, suppressSafetyWarnings].some(v => v !== undefined);
```

在 `updateData` 區塊（第 43 行後），仿照其他欄位加入：

```typescript
if (suppressSafetyWarnings !== undefined) {
  updateData.suppress_safety_warnings = Boolean(suppressSafetyWarnings);
}
```

在 `insertData` 區塊（第 99 行後）同樣加入：

```typescript
if (suppressSafetyWarnings !== undefined) {
  insertData.suppress_safety_warnings = Boolean(suppressSafetyWarnings);
}
```

- [ ] **Step 4：修改 `pages/profile.vue`，加入 toggle UI**

在 `formData` ref（第 73 行）加入新欄位：

```typescript
const formData = ref({
  skinType: '',
  ageGroup: '',
  gender: '' as Gender,
  issues: '',
  suppressSafetyWarnings: false   // ← 新增
})
```

在 `fillFormFromStore`（第 83 行）加入映射：

```typescript
const fillFormFromStore = () => {
  const profile = userProfileStore.profile
  if (!profile) return
  formData.value = {
    skinType: profile.base_skin_type || '',
    ageGroup: profile.age_group || '',
    gender: (profile.gender || '') as Gender,
    issues: profile.issues || '',
    suppressSafetyWarnings: profile.suppress_safety_warnings ?? false   // ← 新增
  }
}
```

在 `handleSubmit` 的 `updateUserProfile` 呼叫（第 101 行）加入：

```typescript
await userProfileStore.updateUserProfile({
  base_skin_type: formData.value.skinType,
  age_group: formData.value.ageGroup || null,
  gender: (formData.value.gender || null) as 'male' | 'female' | 'other' | null,
  issues: formData.value.issues || null,
  suppress_safety_warnings: formData.value.suppressSafetyWarnings   // ← 新增
})
```

在 template 的「儲存修改」按鈕（第 56 行）**上方**加入 toggle UI：

```html
<div class="form-group">
  <label class="form-label">進階使用者模式</label>
  <p class="hint-text">開啟後，分析頁的「膚質地雷」提示將隱藏。法規禁用成分警告不受影響。</p>
  <label class="toggle-switch">
    <input type="checkbox" v-model="formData.suppressSafetyWarnings" />
    <span class="toggle-track"><span class="toggle-thumb"></span></span>
    <span class="toggle-label">
      {{ formData.suppressSafetyWarnings ? '已開啟（隱藏膚質提示）' : '關閉（顯示所有警告）' }}
    </span>
  </label>
</div>
```

在 `<style scoped>` 加入：

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

- [ ] **Step 5：修改 `pages/index.vue`，讀 store 並條件顯示膚質警告**

在 `<script setup>` 加入（在現有 import 後）：

```typescript
import { useUserProfile } from '~/stores/useUserProfile'
const userProfileStore = useUserProfile()
const suppressWarnings = computed(() => userProfileStore.profile?.suppress_safety_warnings === true)
```

找到 `skinTypeAlerts` 的 `v-if`（第 139 行），改為：

```html
<div
  v-if="!suppressWarnings && result.data.analysis.skinTypeAlerts.length > 0"
  class="alert-block alert-yellow"
>
```

- [ ] **Step 6：手動驗證**

1. 進入分析頁，分析含膚質地雷成分產品 → 應見「膚質注意成分」黃色區塊
2. 進個人資料頁 → 開啟進階模式 → 儲存
3. 再次分析同一產品 → 黃色區塊消失，紅色法規警告仍在
4. 回個人資料關閉進階模式 → 黃色警告恢復

- [ ] **Step 7：Commit**

```bash
git add stores/useUserProfile.ts server/api/profile/get.ts server/api/profile/update.post.ts pages/profile.vue pages/index.vue
git commit -m "feat(profile): 新增進階模式，可靜音分析頁膚質地雷提示"
```

---

## Task 7：每日打卡功能

**效果：** 排程頁每個步驟旁有 ⬜ 按鈕，點擊記錄「今日已完成」，重新整理後保留。再點一次取消打卡。

**注意：** 
- `server/api/routines/checkins/` 目錄**不存在**，建立檔案前先 `mkdir -p server/api/routines/checkins`
- `checkins.get.ts` 的 item ids 查詢與 checkins 查詢**拆成兩步**，避免 nested await 靜默失敗

---

- [ ] **Step 1：建立目錄並新增 `server/api/routines/checkins/toggle.post.ts`**

```bash
mkdir -p server/api/routines/checkins
```

建立 `server/api/routines/checkins/toggle.post.ts`：

```typescript
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
  const userId = user.id || user.sub;
  if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

  const { routine_item_id, checked_date } = await readBody(event);
  if (!routine_item_id || !checked_date) {
    throw createError({ statusCode: 400, statusMessage: '缺少 routine_item_id 或 checked_date' });
  }

  const supabase = await serverSupabaseClient(event);

  const { data: existing } = await (supabase as any)
    .from('routine_checkins')
    .select('id')
    .eq('routine_item_id', routine_item_id)
    .eq('checked_date', checked_date)
    .maybeSingle();

  if (existing) {
    await (supabase as any)
      .from('routine_checkins')
      .delete()
      .eq('id', existing.id);
    return { success: true, checked: false };
  } else {
    await (supabase as any)
      .from('routine_checkins')
      .insert({ user_id: userId, routine_item_id, checked_date });
    return { success: true, checked: true };
  }
});
```

- [ ] **Step 2：新增 `server/api/routines/[id]/checkins.get.ts`**

建立 `server/api/routines/[id]/checkins.get.ts`：

```typescript
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
  const userId = user.id || user.sub;
  if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

  const routineId = getRouterParam(event, 'id');
  const query = getQuery(event);
  const date = String(query.date || new Date().toISOString().slice(0, 10));

  const supabase = await serverSupabaseClient(event);

  // Step A：先取出此 routine 的所有 item ids
  const { data: itemRows, error: itemsError } = await (supabase as any)
    .from('routine_items')
    .select('id')
    .eq('routine_id', routineId);

  if (itemsError) {
    throw createError({ statusCode: 500, statusMessage: '查詢排程項目失敗: ' + itemsError.message });
  }

  const itemIds = (itemRows || []).map((i: any) => i.id);
  if (itemIds.length === 0) {
    return { success: true, data: { checked_ids: [], date } };
  }

  // Step B：查詢今天這些 items 的打卡記錄
  const { data: checkins, error: checkinsError } = await (supabase as any)
    .from('routine_checkins')
    .select('routine_item_id')
    .eq('user_id', userId)
    .eq('checked_date', date)
    .in('routine_item_id', itemIds);

  if (checkinsError) {
    throw createError({ statusCode: 500, statusMessage: '查詢打卡記錄失敗: ' + checkinsError.message });
  }

  const checkedIds = (checkins || []).map((c: any) => c.routine_item_id);
  return { success: true, data: { checked_ids: checkedIds, date } };
});
```

- [ ] **Step 3：修改 `components/routine/RoutineDayPanel.vue`，加入打卡 prop 與按鈕**

在 `defineProps` 加入（找到現有 props 末尾）：

```typescript
checkedItemIds: {
  type: Object as PropType<Set<string>>,
  default: () => new Set<string>()
}
```

在 `defineEmits` 加入：

```typescript
'toggle-checkin': [itemId: string]
```

在每個 scheduled item 的 `.item-actions` 按鈕區（鎖定按鈕旁），加入打卡按鈕：

```html
<button
  v-if="item.id"
  @click.stop="$emit('toggle-checkin', item.id)"
  class="btn-checkin"
  :class="{ 'is-checked': checkedItemIds.has(item.id) }"
  title="今日打卡"
>{{ checkedItemIds.has(item.id) ? '✅' : '⬜' }}</button>
```

在 `<style scoped>` 加入：

```css
.btn-checkin { background: none; border: none; cursor: pointer; font-size: 15px; padding: 2px 4px; line-height: 1; }
```

- [ ] **Step 4：修改 `pages/routines/[id].vue`，加入打卡狀態與 handler**

在 `<script setup>` 的 imports 後加入：

```typescript
const today = new Date().toISOString().slice(0, 10);
const checkedItemIds = ref(new Set<string>());

const loadCheckins = async () => {
  if (!routineId) return;
  try {
    const res = await $fetch<{ success: boolean; data: { checked_ids: string[] } }>(
      `/api/routines/${routineId}/checkins`,
      { query: { date: today } }
    );
    checkedItemIds.value = new Set(res.data.checked_ids);
  } catch {
    // 非致命，打卡狀態載入失敗不阻斷頁面
  }
};

const handleToggleCheckin = async (itemId: string) => {
  const res = await $fetch<{ success: boolean; checked: boolean }>(
    '/api/routines/checkins/toggle',
    { method: 'POST', body: { routine_item_id: itemId, checked_date: today } }
  );
  if (res.checked) {
    checkedItemIds.value.add(itemId);
  } else {
    checkedItemIds.value.delete(itemId);
  }
  checkedItemIds.value = new Set(checkedItemIds.value); // 觸發 Vue reactivity
};
```

找到 `onMounted` 的地方（已有 `fetchProduct` 或 page load 邏輯），加入 `loadCheckins()`：

```typescript
onMounted(() => {
  // ... 原有載入邏輯
  loadCheckins();
});
```

在 `<RoutineDayPanel>` 的 template 加入兩個新 props：

```html
:checked-item-ids="checkedItemIds"
@toggle-checkin="handleToggleCheckin"
```

- [ ] **Step 5：手動驗證**

1. 進排程頁 → 每個步驟右側出現 ⬜
2. 點 ⬜ → 變 ✅，無頁面跳轉
3. 重新整理 → ✅ 持續（今日打卡保留）
4. 再點 ✅ → 取消打卡，回 ⬜
5. 跨天：隔天（或把系統日期往後一天測試）→ 重置為 ⬜

- [ ] **Step 6：Commit**

```bash
git add server/api/routines/checkins/toggle.post.ts server/api/routines/[id]/checkins.get.ts components/routine/RoutineDayPanel.vue pages/routines/[id].vue
git commit -m "feat(routine): 排程步驟每日打卡功能"
```

---

## Task 8：產品效期追蹤（expires_at）

**效果：** 產品編輯頁新增「預估到期日」欄位，依類別自動推算（PAO），也可手動填。保養品卡顯示「已過期」或「快到期」badge。

**重要：已完成項目（不需再做）：**
- `opened_at`、`estimated_finish_days`、`purchase_purpose`、`user_notes`：DB 欄位 + edit.vue + [id].put.ts 全部已完成
- `beauty-plan.vue` 已有 `daysUntilFinish()` 顯示「快用完」提示

**本 Task 只補：** `expires_at` 欄位（明確到期日）+ `expiry_status` 計算 + badge。

**PAO 預設（開封後建議使用期限）：**
| 類別 | 預設月數 |
|------|---------|
| 精華液 | 6 個月 |
| 眼霜 | 6 個月 |
| 去角質 | 6 個月 |
| 乳液 / 乳霜 / 面霜 | 12 個月 |
| 防曬 | 12 個月 |
| 其他 | 12 個月 |

---

- [ ] **Step 1：修改 `server/api/cabinet/[id].put.ts`，接受並儲存 `expires_at`**

在第 30 行（現有 `opened_at` 宣告旁），加入：

```typescript
const {
  product_name,
  product_category,
  opened_at,
  expires_at,           // ← 新增
  estimated_finish_days,
  purchase_purpose,
  user_notes
} = body;
```

在第 38 行的 `hasTrackingFields` 判斷加入：

```typescript
const hasTrackingFields = opened_at !== undefined || expires_at !== undefined ||
  estimated_finish_days !== undefined || purchase_purpose !== undefined || user_notes !== undefined;
```

在 `updateData` 賦值區塊（第 49 行後）加入：

```typescript
if (expires_at !== undefined) updateData.expires_at = expires_at || null;
```

- [ ] **Step 2：修改 `server/api/cabinet/list.get.ts`，計算 `expiry_status`**

在檔案頂部（import 之後，`defineEventHandler` 之前）加入輔助函數：

```typescript
function getExpiryStatus(expiresAt: string | null | undefined): 'expired' | 'soon' | 'ok' | null {
  if (!expiresAt) return null;
  const diffDays = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'soon';
  return 'ok';
}
```

在第 77 行現有的 `enrichedData` map 裡，加入 `expiry_status`：

```typescript
const enrichedData = (data || []).map((p: any) => ({
  ...p,
  routine_usage_count: usageMap.get(p.id) || 0,
  expiry_status: getExpiryStatus(p.expires_at)   // ← 新增
}));
```

- [ ] **Step 3：修改 `pages/products/[id]/edit.vue`，加入 expires_at 欄位**

在 `tracking` reactive（第 169 行）加入：

```typescript
const tracking = reactive({
  opened_at: '' as string,
  expires_at: '' as string,             // ← 新增
  estimated_finish_days: null as number | null,
  purchase_purpose: '' as string,
  user_notes: '' as string
})
```

在 `fetchProduct` 的 tracking 初始化（第 195 行後），加入：

```typescript
tracking.expires_at = response.data.expires_at
  ? String(response.data.expires_at).slice(0, 10)
  : ''
```

在 `saveTracking` 的 body（第 276 行），加入：

```typescript
body: {
  opened_at: tracking.opened_at || null,
  expires_at: tracking.expires_at || null,   // ← 新增
  estimated_finish_days: tracking.estimated_finish_days,
  purchase_purpose: tracking.purchase_purpose || null,
  user_notes: tracking.user_notes || null
}
```

在 `<script setup>` 加入 PAO 自動計算函數：

```typescript
const PAO_MONTHS: Record<string, number> = {
  '精華液': 6, '眼霜': 6, '去角質': 6,
  '乳液': 12, '乳霜': 12, '面霜': 12, '防曬': 12
};

const autoCalcExpiry = () => {
  if (!tracking.opened_at || !product.value?.product_category) return;
  const months = PAO_MONTHS[product.value.product_category] ?? 12;
  const d = new Date(tracking.opened_at);
  d.setMonth(d.getMonth() + months);
  tracking.expires_at = d.toISOString().slice(0, 10);
};
```

在 template 的「開封日期」`<input>`（第 51 行）加入 `@change`：

```html
<input
  id="opened_at"
  v-model="tracking.opened_at"
  type="date"
  class="form-input"
  @change="autoCalcExpiry"
/>
```

在「開封日期」欄位之後，加入新欄位：

```html
<div class="form-group">
  <label class="form-label" for="expires_at">預估到期日</label>
  <p class="hint-text">依類別自動推算（可手動調整）</p>
  <input
    id="expires_at"
    v-model="tracking.expires_at"
    type="date"
    class="form-input"
  />
</div>
```

- [ ] **Step 4：修改 `pages/beauty-plan.vue`，加入效期 badge**

找到現有 `routine-usage-badge` 的 `<span>`（第 66 行附近），在其旁邊加入：

```html
<span
  v-if="(product as any).expiry_status === 'expired'"
  class="expiry-badge expiry-badge--expired"
>已過期</span>
<span
  v-else-if="(product as any).expiry_status === 'soon'"
  class="expiry-badge expiry-badge--soon"
>快到期</span>
```

在 `<style scoped>` 加入：

```css
.expiry-badge { font-size: 11px; border-radius: var(--radius-sm); padding: 1px 6px; }
.expiry-badge--expired { color: var(--color-critical); border: 1px solid var(--color-critical); }
.expiry-badge--soon { color: var(--color-amber); border: 1px solid var(--color-amber); }
```

- [ ] **Step 5：手動驗證**

1. 進任意產品編輯頁 → 填入今天的開封日期 → 「預估到期日」自動帶入（依類別計算）
2. 按「儲存追蹤資料」→ 成功
3. 回到保養品頁 → 該產品**不顯示**警告（未到期）
4. 回到編輯頁，把「預估到期日」改為昨天 → 儲存 → 回保養品頁 → 顯示「已過期」紅色 badge
5. 改為 15 天後 → 顯示「快到期」橘色 badge

- [ ] **Step 6：Commit**

```bash
git add server/api/cabinet/[id].put.ts server/api/cabinet/list.get.ts pages/products/[id]/edit.vue pages/beauty-plan.vue
git commit -m "feat(cabinet): 產品效期追蹤，PAO 自動推算到期日並在卡片顯示警告"
```

---

## Task 9：今日排程快速入口

**效果：** 導覽列（任何頁面）新增「今日排程」按鈕，僅登入用戶可見。點擊後直達 active routine 詳細頁；無排程時跳回保養規劃頁。訪客分析功能完全不受影響。

**後端：** 使用已實作的 `GET /api/routines/active`，零改動。

---

- [ ] **Step 1：新增 `pages/routines/active.vue`（redirect 頁）**

建立 `pages/routines/active.vue`：

```vue
<script setup lang="ts">
const { data } = await useFetch('/api/routines/active')

const routineId = (data.value as any)?.data?.id
if (routineId) {
  await navigateTo(`/routines/${routineId}`, { replace: true })
} else {
  await navigateTo('/beauty-plan', { replace: true })
}
</script>

<template>
  <div></div>
</template>
```

- [ ] **Step 2：修改 `app.vue`，在 `nav-right` 加入「今日排程」按鈕**

在 `nav-right` 的 `<div class="nav-right">` 內，`nav-menu-wrap` **前**加入：

```html
<NuxtLink
  v-if="user"
  to="/routines/active"
  class="nav-routine-btn"
>今日排程</NuxtLink>
```

在 `<style scoped>` 加入：

```css
.nav-routine-btn {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-text-secondary);
  text-decoration: none;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color 0.18s, color 0.18s;
}
.nav-routine-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
```

- [ ] **Step 3：手動驗證**

1. 登入 → 導覽列出現「今日排程」按鈕
2. 點擊 → 直達目前 active 排程頁（`/routines/<id>`）
3. 登出 → 按鈕消失，訪客不見
4. 未設定任何 active 排程的帳號 → 點擊後跳到 `/beauty-plan`
5. 分析頁（訪客功能）→ 正常運作，不受影響

- [ ] **Step 4：Commit**

```bash
git add pages/routines/active.vue app.vue
git commit -m "feat(nav): 新增今日排程快速入口，登入後一鍵進入 active 排程"
```

---

## 完成後

```bash
git push origin main
```
