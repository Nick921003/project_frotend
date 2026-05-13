# 功效推薦重構 + 首頁雙欄 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 兩個獨立功能，各自可單獨執行。
- **Task A**：將排程推薦從「缺少品類」改為「功效導向 AI 推薦」，並清除舊有冗餘邏輯
- **Task B**：首頁分析頁改雙欄佈局，左上傳、右結果，不需滾動

**不需要 DB migration。**

---

## ⚠️ 執行前必讀：要刪哪些舊邏輯

### Task A 會刪除的舊邏輯

| 位置 | 要刪的內容 | 原因 |
|------|-----------|------|
| `useRoutineRecommendations.ts` | `OPTIONAL_CATEGORIES` 常數 | 新邏輯不依品類判斷 |
| `useRoutineRecommendations.ts` | `USAGE_ORDER` 陣列 | 移至 `RoutineRecommendations.vue` 靜態常數 |
| `useRoutineRecommendations.ts` | `extractReasonIngredients()` function | 新邏輯不需萃取成分關鍵字 |
| `useRoutineRecommendations.ts` | `missingCategories` computed | 整個推薦邏輯改寫 |
| `useRoutineRecommendations.ts` | `unifiedRecommendations` computed | 整個推薦邏輯改寫 |
| `useRoutineRecommendations.ts` | `aiSuggestedItems` ref + `loadTempRecommendations()` | sessionStorage 傳遞推薦的機制廢棄 |
| `server/api/routines/create.post.ts` | 第 208-243 行：`recommendationMap` 建置邏輯 | 推薦不再由排程生成時一起做 |
| `server/api/routines/create.post.ts` | `weeklyRoutine.recommendations = recommendations` | 同上 |
| `pages/routines/new.vue` | `sessionStorage.setItem(route-ai-recommendations:...)` (兩處) | sessionStorage 機制廢棄 |
| `pages/routines/new.vue` | `regenResult: 'recommended'` query param 跳轉邏輯 | 同上 |
| `pages/routines/[id].vue` | `if (route.query.regenResult === 'recommended') loadTempRecommendations()` | 同上 |
| `RoutineRecommendations.vue` | 整個 `<div class="recommendations-section">` 區塊 | 換成新 UI |

---

## Task A：功效導向 AI 推薦

### 設計說明

**舊邏輯（廢棄）：**
排程生成時，把 AI 推薦的（`is_recommendation=true`）items 和「保養品櫃缺少的品類」合併顯示 → 品類都有就看不到任何推薦。

**新邏輯：**
```
排程頁載入 → 呼叫 POST /api/routines/[id]/efficacy-recs
  輸入：使用者膚質 + 困擾 + 現有保養品的成分摘要
  Gemini：分析現有成分覆蓋了哪些功效，哪些還缺
  輸出：List<{ issue, category, suggestedIngredients, reason }>
排程頁：顯示功效導向推薦卡片 + 一個「前往新增產品」按鈕
```

**輸出格式範例：**
```json
[
  {
    "issue": "黑眼圈",
    "category": "眼霜",
    "suggestedIngredients": ["Caffeine", "Peptides", "Vitamin K"],
    "reason": "您選擇的困擾包含黑眼圈，現有產品未含咖啡因或胜肽類，建議補充"
  },
  {
    "issue": "控油抗痘",
    "category": "化妝水",
    "suggestedIngredients": ["Niacinamide", "Zinc"],
    "reason": "您現有精華液已含 Salicylic Acid，但缺少菸鹼醯胺協同控油，建議補充"
  }
]
```

---

- [ ] **Step 1：新增 `server/services/aiService.ts` 的 `generateEfficacyRecommendations()` method**

在 `AIService` class 內，`generateDetailedRoutine()` 方法之後新增：

```typescript
/**
 * 根據使用者膚況與現有保養品，生成功效導向補充推薦
 */
async generateEfficacyRecommendations(
  profile: UserProfileData,
  products: CabinetProduct[],
  targetIssues: string[]
): Promise<Array<{ issue: string; category: string; suggestedIngredients: string[]; reason: string }>> {
  const existingSummary = products.map(p => {
    const ings = this.tryParseIngredients(p.raw_ingredients).slice(0, 8).join(', ');
    return `- ${p.product_name}（${p.product_category}）: ${ings || '成分未知'}`;
  }).join('\n');

  const prompt = `你是一位專業化妝品配方師。以下是使用者資料與現有保養品：

膚質：${profile.base_skin_type}
困擾：${targetIssues.length > 0 ? targetIssues.join('、') : profile.issues || '一般保養'}
現有產品與主要成分：
${existingSummary || '（無產品）'}

請分析現有產品的成分覆蓋，找出「功效缺口」，針對使用者的困擾給出 2~4 條補充建議。
即使某品類已有產品，也可以推薦含不同功效成分的同品類產品。

以 JSON 陣列回傳，每筆格式如下：
{
  "issue": "對應的困擾（如：控油抗痘）",
  "category": "建議的品類（如：精華液、眼霜）",
  "suggestedIngredients": ["成分1", "成分2"],
  "reason": "為什麼需要補充，現有產品缺了什麼（繁體中文，1~2句）"
}

只回傳 JSON 陣列，不要其他文字。`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(this.config.apiKey);
    const model = genAI.getGenerativeModel({
      model: this.config.model,
      generationConfig: { temperature: 0.4 }
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    console.warn('[AIService] generateEfficacyRecommendations 失敗:', e.message);
    return [];
  }
}
```

- [ ] **Step 2：新增 `server/api/routines/[id]/efficacy-recs.post.ts`**

```typescript
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { getAIService } from '~/server/services/aiService';

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
  const userId = user.id || user.sub;

  const routineId = getRouterParam(event, 'id');
  const body = await readBody(event);
  const targetIssues: string[] = Array.isArray(body.targetIssues) ? body.targetIssues : [];

  const supabase = await serverSupabaseClient(event);

  // 取得使用者個人資料
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('base_skin_type, issues, gender, birth_year')
    .eq('user_id', userId)
    .single();

  // 取得保養品櫃
  const { data: products } = await (supabase as any)
    .from('user_cabinet')
    .select('product_name, product_category, raw_ingredients')
    .eq('user_id', userId);

  if (!profile) throw createError({ statusCode: 404, statusMessage: '找不到個人資料' });

  const aiService = getAIService();
  const recommendations = await aiService.generateEfficacyRecommendations(
    profile,
    products || [],
    targetIssues
  );

  return { success: true, data: recommendations };
});
```

- [ ] **Step 3：清除 `server/api/routines/create.post.ts` 的舊推薦邏輯**

找到以下區塊並刪除（第 208-243 行附近）：

```typescript
  const recommendationMap = new Map<string, RoutineRecommendation>();
  for (const item of weeklyRoutine.items) {
    // ... （整個 for 迴圈）
  }
  const recommendations = Array.from(recommendationMap.values());
```

以及：
```typescript
  weeklyRoutine.recommendations = recommendations;
```

`return` 中的 `recommendations: weeklyRoutine.recommendations || []` 可保留（回傳空陣列不影響）。

- [ ] **Step 4：改寫 `composables/useRoutineRecommendations.ts`**

整個檔案改寫如下（刪除所有舊邏輯，換成新介面）：

```typescript
import { ref } from 'vue';
import type { Ref } from 'vue';
import type { WeeklyRoutine, CabinetProductItem } from '~/types/routine';

export interface EfficacyRecommendation {
  issue: string;
  category: string;
  suggestedIngredients: string[];
  reason: string;
}

// 使用順序建議（靜態，不依賴 API）
export const USAGE_ORDER_TIPS = [
  { category: '洗臉產品', timing: '早晚', tip: '清潔第一步，溫和帶走污垢', step: 1 },
  { category: '化妝水', timing: '早晚', tip: '補水收斂，幫助後續成分吸收', step: 2 },
  { category: '精華液', timing: '早晚', tip: '集中護理，針對肌膚問題', step: 3 },
  { category: '眼霜', timing: '早晚', tip: '在乳液前使用，輕拍至吸收', step: 4 },
  { category: '乳液', timing: '早晚', tip: '鎖水保濕，封住前一步驟成分', step: 5 },
  { category: '面膜', timing: '晚間', tip: '建議 1–3 次/週，可替換精華步驟', step: 6 },
  { category: '防曬', timing: '早晨', tip: '日間最後一步，需均勻補擦', step: 7 },
];

export function useRoutineRecommendations(
  routine: Ref<WeeklyRoutine | null>,
  availableProducts: Ref<CabinetProductItem[]>,
  routineId: string
) {
  const efficacyRecs = ref<EfficacyRecommendation[]>([]);
  const recsLoading = ref(false);

  const loadEfficacyRecs = async (targetIssues: string[]) => {
    if (!routineId) return;
    recsLoading.value = true;
    try {
      const res = await $fetch<{ success: boolean; data: EfficacyRecommendation[] }>(
        `/api/routines/${routineId}/efficacy-recs`,
        { method: 'POST', body: { targetIssues } }
      );
      if (res.success) efficacyRecs.value = res.data;
    } catch (e) {
      console.warn('[useRoutineRecommendations] 功效推薦載入失敗');
    } finally {
      recsLoading.value = false;
    }
  };

  return {
    efficacyRecs,
    recsLoading,
    loadEfficacyRecs,
    usageOrderTips: USAGE_ORDER_TIPS,
  };
}
```

- [ ] **Step 5：改寫 `components/routine/RoutineRecommendations.vue`**

Props 改為：
```typescript
defineProps<{
  efficacyRecs: EfficacyRecommendation[];
  recsLoading: boolean;
  usageOrderTips: typeof USAGE_ORDER_TIPS;
  routineId: string;
}>();
```

Template 結構：
```html
<template>
  <div class="recommendations-container">
    <!-- 功效導向推薦 -->
    <div class="recs-section">
      <div class="recs-header">
        <h2>AI 功效推薦</h2>
        <p class="recs-subtitle">根據您的膚況與現有成分缺口，建議補充以下產品</p>
      </div>

      <div v-if="recsLoading" class="recs-loading">分析中...</div>

      <div v-else-if="efficacyRecs.length === 0" class="recs-empty">
        點擊「AI 推薦」按鈕，根據困擾生成補充建議
      </div>

      <div v-else class="recs-list">
        <div
          v-for="rec in efficacyRecs"
          :key="`${rec.issue}-${rec.category}`"
          class="rec-card"
        >
          <div class="rec-issue">{{ rec.issue }}</div>
          <div class="rec-category">建議品類：<strong>{{ rec.category }}</strong></div>
          <div class="rec-ingredients">
            推薦成分：
            <span v-for="ing in rec.suggestedIngredients" :key="ing" class="ing-chip">{{ ing }}</span>
          </div>
          <p class="rec-reason">{{ rec.reason }}</p>
        </div>
        <button class="btn btn-secondary btn-sm" @click="$emit('go-add-product', '')">
          前往新增產品
        </button>
      </div>
    </div>

    <!-- 使用順序建議 -->
    <div class="usage-tips-section">
      <h3>建議使用順序</h3>
      <div class="usage-steps">
        <div v-for="tip in usageOrderTips" :key="tip.category" class="usage-step">
          <div class="step-number">{{ tip.step }}</div>
          <div class="step-body">
            <strong class="step-cat">{{ tip.category }}</strong>
            <span class="step-timing">{{ tip.timing }}</span>
            <span class="step-note">{{ tip.tip }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

加上樣式（延用既有 CSS 變數）：
```css
.rec-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-sm);
  background: var(--color-surface);
}
.rec-issue {
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 600;
  margin-bottom: 4px;
}
.rec-category { font-size: 14px; margin-bottom: 4px; }
.rec-ingredients { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px; }
.ing-chip {
  display: inline-block;
  background: var(--color-surface-alt);
  border-radius: 99px;
  padding: 1px 8px;
  margin: 0 2px;
  font-size: 11px;
}
.rec-reason { font-size: 12px; color: var(--color-text-secondary); font-style: italic; margin: 0; }
.recs-loading, .recs-empty { font-size: 13px; color: var(--color-text-secondary); padding: var(--space-md) 0; }
```

- [ ] **Step 6：更新 `pages/routines/[id].vue`**

① 清除舊的 import 與呼叫：
```typescript
// 刪除：
import { useRoutineRecommendations } from '~/composables/useRoutineRecommendations';
// 改為保留但更新解構：
const { efficacyRecs, recsLoading, loadEfficacyRecs, usageOrderTips } = useRoutineRecommendations(
  routine, availableProducts, routineId
);
```

② 刪除 `onMounted` 裡的：
```typescript
if (route.query.regenResult === 'recommended') loadTempRecommendations();
```

③ 在 `<RoutineRecommendations>` 傳入新 props：
```html
<RoutineRecommendations
  :efficacy-recs="efficacyRecs"
  :recs-loading="recsLoading"
  :usage-order-tips="usageOrderTips"
  :routine-id="routineId"
  @go-add-product="goToAddProduct"
/>
```

④ 新增「AI 推薦」按鈕（放在 `AI 重新排成` 旁邊）：
```html
<button class="btn btn-secondary" :disabled="recsLoading" @click="triggerEfficacyRecs">
  {{ recsLoading ? '分析中...' : 'AI 推薦' }}
</button>
```

```typescript
// 取得目前排程的 targetIssues（來自 routine.value.themes 或固定傳空陣列）
const triggerEfficacyRecs = () => {
  const issues = routine.value?.themes || [];
  loadEfficacyRecs(issues);
};
```

- [ ] **Step 7：清除 `pages/routines/new.vue` 的 sessionStorage 邏輯**

找到以下兩處刪除：
```typescript
sessionStorage.setItem(`routine-ai-recommendations:${targetRoutineId.value}`, JSON.stringify(recommendations))
```
```typescript
sessionStorage.setItem(`routine-ai-recommendations:${routine.value.routine_id}`, JSON.stringify(createdRecs))
```

以及相關的 `if (typeof window !== 'undefined' && createdRecs.length > 0)` 條件和 query param：
```typescript
query: createdRecs.length > 0 ? { regenResult: 'recommended', recCount: String(createdRecs.length) } : {}
```
改為直接：
```typescript
router.push({ path: `/routines/${routine.value!.routine_id}` })
```

- [ ] **Step 8：手動驗證**

1. 進入排程頁 → 點「AI 推薦」→ 稍等 5~15 秒 → 出現功效推薦卡片
2. 推薦內容包含：對應困擾、建議品類、推薦成分、理由
3. 點「前往新增產品」可跳轉至保養品新增頁

- [ ] **Step 9：Commit**
```bash
git add -A
git commit -m "feat(routine): 功效導向 AI 推薦，清除舊品類缺口邏輯"
```

---

## Task B：首頁分析頁雙欄佈局

### 設計說明

**現況：** `pages/index.vue` 單欄，步驟 1（膚質）→ 步驟 2（上傳）→ 分析按鈕 → 結果，需大量滾動。

**目標：**
```
┌─────────────────────┬──────────────────────────┐
│  左欄（固定）        │  右欄（結果，可滾動）      │
│  步驟1：膚質         │  分析報告                 │
│  步驟2：上傳圖片     │  法規警告                 │
│  產品名稱/品類       │  膚質地雷                 │
│  開始分析 按鈕       │  安全成分                 │
│  加入保養品櫃 按鈕   │  AI 總評                  │
└─────────────────────┴──────────────────────────┘
```

- 左欄：`position: sticky; top: 0` — 固定不滾動
- 右欄：結果出現前顯示「等待分析」佔位
- 手機版（< 768px）退回單欄，左欄在上，右欄在下

---

- [ ] **Step 1：修改 `pages/index.vue` template 結構**

將原本的 `.page-container > .card` 結構改為雙欄：

```html
<template>
  <div class="page-container">
    <div class="analyze-layout">
      <!-- 左欄：操作區 -->
      <div class="analyze-left">
        <div class="status-bar">...</div>
        <h2 class="page-heading">保養品成分分析</h2>

        <!-- 步驟 1：膚質 -->
        <div class="card step-card">...</div>

        <!-- 步驟 2：上傳 -->
        <div class="card step-card upload-card">...</div>

        <!-- 按鈕區 -->
        <button class="btn btn-primary btn-lg action-btn" ...>開始分析成分</button>
        <button v-if="analysisReady && user && !saveMsg" class="btn btn-lg action-btn--save" ...>加入保養品櫃</button>
        <div v-if="saveMsg" class="status-box status-success">...</div>
        <div v-if="errorMsg" class="status-box status-error">...</div>
      </div>

      <!-- 右欄：結果區 -->
      <div class="analyze-right">
        <div v-if="!result?.data?.analysis" class="result-placeholder">
          <p>上傳成分表照片後，分析結果會顯示在這裡</p>
        </div>
        <div v-else class="results-section">
          <!-- 搬移原本的 results-section 內容 -->
          ...
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2：更新 `pages/index.vue` 的 CSS**

```css
.analyze-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: var(--space-6);
  align-items: start;
}

.analyze-left {
  position: sticky;
  top: var(--space-4);
}

.analyze-right {
  min-height: 400px;
}

.result-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  border: 1px dashed var(--color-warm-dark);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  font-size: 14px;
  text-align: center;
}

/* 手機版退回單欄 */
@media (max-width: 768px) {
  .analyze-layout {
    grid-template-columns: 1fr;
  }
  .analyze-left {
    position: static;
  }
}
```

- [ ] **Step 3：手動驗證**

桌面版（> 768px）：左欄固定，右欄結果可滾動；手機版退回單欄正常顯示。

- [ ] **Step 4：Commit**
```bash
git add pages/index.vue
git commit -m "feat(index): 分析頁改雙欄佈局，左操作右結果"
```
