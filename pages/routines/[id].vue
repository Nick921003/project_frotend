<template>
  <div class="schedule-page">
    <!-- 標題區 -->
    <div class="header">
      <h1>📅 每週保養排程</h1>
      <div v-if="routine" class="routine-meta-editor">
        <input
          v-model="routineNameDraft"
          class="meta-name-input"
          type="text"
          maxlength="60"
          placeholder="請輸入排程名稱"
        />
        <textarea
          v-model="routineDescriptionDraft"
          class="meta-description-input"
          rows="2"
          placeholder="排程描述（可選）"
        ></textarea>
        <div class="meta-actions">
          <button @click="saveRoutineMeta" class="btn-save-meta" :disabled="savingMeta || !routineNameDraft.trim()">
            {{ savingMeta ? '保存中...' : '保存名稱' }}
          </button>
          <button @click="resetRoutineMetaDraft" class="btn-reset-meta" :disabled="savingMeta">
            取消
          </button>
        </div>

        <button class="theme-merge-toggle" @click="showThemeEditor = !showThemeEditor">
          {{ showThemeEditor ? '收合主題設定' : '編輯排程主題' }}
        </button>

        <div v-if="showThemeEditor" class="themes-section inline-merged">
          <div class="themes-header">
            <h2>🎨 排程主題</h2>
            <p class="themes-subtitle">主題設定已合併到上方名稱區，保存後立即生效</p>
          </div>

          <div class="themes-grid">
            <div
              v-for="theme in AVAILABLE_ROUTINE_THEMES"
              :key="theme.id"
              class="theme-checkbox"
              :class="{ selected: isThemeSelected(theme.id) }"
              role="button"
              tabindex="0"
              :aria-pressed="isThemeSelected(theme.id)"
              @click="toggleTheme(theme.id)"
              @keydown.enter.prevent="toggleTheme(theme.id)"
              @keydown.space.prevent="toggleTheme(theme.id)"
            >
              <div class="theme-icon">{{ theme.icon }}</div>
              <div class="theme-info">
                <div class="theme-label">{{ theme.label }}</div>
                <div class="theme-desc">{{ theme.description }}</div>
              </div>
              <div v-if="isThemeSelected(theme.id)" class="checkmark">✓</div>
            </div>
          </div>

          <div class="custom-themes">
            <label>新增自定義主題</label>
            <div class="custom-input-group">
              <input
                v-model="currentCustomTheme"
                type="text"
                placeholder="例如：快速護膚、密集修護等"
                @keydown.enter="addCustomTheme"
              />
              <button @click="addCustomTheme" class="btn-add-theme">新增</button>
            </div>

            <div v-if="selectedCustomThemes.length > 0" class="custom-themes-list">
              <div
                v-for="(customTheme, idx) in selectedCustomThemes"
                :key="`custom-${idx}`"
                class="custom-theme-badge"
              >
                {{ customTheme }}
                <button @click="removeCustomTheme(idx)" class="btn-remove">✕</button>
              </div>
            </div>
          </div>

          <button @click="saveThemes" class="btn-save-themes">💾 保存主題設定</button>
        </div>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="mode-toggle">
      <button
        @click="goToAIPreferences"
        class="mode-btn ai-regenerate"
        :disabled="savingOrder"
      >
        🤖 AI 重新排成
      </button>
    </div>

    <!-- 載入狀態 -->
    <div v-if="pageLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在載入排程...</p>
    </div>

    <!-- 錯誤提示 -->
    <div v-if="pageError" class="error-banner">
      ❌ {{ pageError }}
    </div>

    <div v-if="!pageLoading && routine" class="content">
      <!-- 空排程提示區塊（高優先級） -->
      <div v-if="routine.items.length === 0 && !routine.created_by_ai" class="empty-routine-alert">
        <div class="alert-icon">📋</div>
        <div class="alert-content">
          <h2>您的排程還是空的</h2>
          <p v-if="routine._empty_reason === 'no_products'" class="alert-message">
            您目前還沒有添加任何保養品。請先前往 <strong>保養品櫃</strong> 添加一些產品，我就能幫您生成排程。
          </p>
          <p v-else class="alert-message">
            排程中還沒有任何項目。您可以從左側的保養品庫存中拖拽產品到日程表，或返回重新生成排程。
          </p>
          <div class="alert-actions">
            <button @click="goToCabinet" class="btn-primary">
              🧴 前往保養品櫃
            </button>
            <button @click="goBack" class="btn-secondary">
              ← 返回上一頁
            </button>
          </div>
        </div>
      </div>
      <!-- 建議添購區塊（AI 推薦） -->
      <div v-if="unifiedRecommendations.length > 0" class="recommendations-section">
        <div class="recommendations-header">
          <div class="header-left">
            <h2>🎯 AI 的智慧推薦</h2>
            <p class="header-subtitle">同一筆顯示「品類 + 推薦成分」，不自動加入排程</p>
          </div>
          <div class="recommendation-tools">
            <div class="recommendation-count">
              <span class="count-badge">{{ unifiedRecommendations.length }}</span>
              <span class="count-label">項建議</span>
            </div>
            <button
              class="recommendation-toggle"
              :aria-expanded="showRecommendations"
              @click="showRecommendations = !showRecommendations"
            >
              {{ showRecommendations ? '收起推薦' : '展開推薦' }}
            </button>
          </div>
        </div>

        <div v-show="showRecommendations" class="recommendation-list">
          <div class="recommendation-card">
            <div class="card-header">
              <div class="icon">🧪</div>
              <div class="ingredient-name">品類與推薦成分（不自動加入）</div>
            </div>
            <div class="card-footer">
              <div v-for="rec in unifiedRecommendations" :key="`${rec.category}-${rec.productName}`" class="missing-item-row recommendation-row">
                <div class="rec-text">
                  <strong>{{ rec.category }}</strong>
                  <span>：{{ rec.ingredientsText }}</span>
                </div>
                <button class="add-link-btn" @click="goToAddProduct(rec.category)">新增產品</button>
              </div>
            </div>
          </div>
        </div>

        <div v-show="showRecommendations" class="recommendations-info">
          <p>💡 建議僅供參考，不會自動加入排程；新增產品後請由您手動點擊「AI 重新排成」。</p>
        </div>
        <div v-show="!showRecommendations" class="recommendations-collapsed-note">
          <p>AI 推薦已收起，點擊「展開推薦」可再次查看內容。</p>
        </div>
      </div>

      <!-- 使用順序建議（產品充足時） -->
      <div v-if="isProductsSufficient" class="usage-tips-section">
        <div class="usage-tips-header">
          <span class="sufficient-badge">✨ 產品完整</span>
          <h3>建議使用順序</h3>
        </div>
        <div class="usage-steps">
          <div v-for="(tip, i) in usageOrderTips" :key="tip.category" class="usage-step">
            <div class="step-number">{{ i + 1 }}</div>
            <div class="step-body">
              <strong class="step-cat">{{ tip.category }}</strong>
              <span class="step-timing">{{ tip.timing }}</span>
              <span class="step-note">{{ tip.tip }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 主要排程區域 -->
      <div class="main-grid">
        <!-- 左側：產品庫存 -->
        <div class="section left-panel">
          <h2>🧴 保養品庫存</h2>
          <p class="note">可拖拽至右側排程區域</p>

          <div class="filter-row">
            <label for="category-filter">分類篩選：</label>
            <select id="category-filter" v-model="selectedCategoryFilter" class="category-filter-select">
              <option value="ALL">全部（預設）</option>
              <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <div class="product-list">
            <div
              v-for="product in filteredAvailableProducts"
              :key="product.id || product.product_name"
              class="product-item draggable"
              :class="{ 'is-recommendation': product.is_recommendation }"
              draggable="true"
              @dragstart="onInventoryDragStart($event, product)"
            >
              <span class="product-name">{{ product.product_name }}</span>
              <span class="product-category-tag">{{ toDisplayCategory(product.product_category) }}</span>
              <span v-if="product.is_recommendation" class="badge">AI建議</span>
            </div>
            <div v-if="filteredAvailableProducts.length === 0" class="empty-inventory">
              <p>沒有可用的產品</p>
            </div>
          </div>
        </div>

        <!-- 右側：每日排程 -->
        <div class="section right-panel">
          <h2>⏰ 週排程</h2>

          <div class="routine-theme-tags" aria-label="目前排程主題">
            <span class="theme-tags-label">目前主題：</span>
            <template v-if="selectedThemeTags.length > 0">
              <span
                v-for="(theme, idx) in selectedThemeTags"
                :key="`table-theme-${idx}-${theme}`"
                class="theme-tag-chip"
              >
                #{{ theme }}
              </span>
            </template>
            <span v-else class="theme-tag-empty">尚未設定主題（可在上方編輯排程主題）</span>
          </div>

          <!-- 日期標籤列 -->
          <div class="day-tabs">
            <button
              v-for="(dayName, dayIdx) in daysOfWeek"
              :key="dayIdx"
              class="day-tab"
              :class="{ 'active': dayIdx === expandedDayIdx }"
              @click="expandedDayIdx = dayIdx"
            >
              {{ dayName }}
              <span
                v-if="getMorningItems(dayIdx).length + getEveningItems(dayIdx).length > 0"
                class="tab-count"
              >{{ getMorningItems(dayIdx).length + getEveningItems(dayIdx).length }}</span>
            </button>
          </div>

          <!-- 單日內容區：直接用 expandedDayIdx，不 v-for 全天 -->
          <div class="day-view">
            <!-- 早晨排程 -->
            <div class="time-slot morning">
              <div class="time-label">🌅 早晨</div>
              <div
                class="drop-zone"
                @dragover.prevent
                @drop="onProductDrop($event, expandedDayIdx, 'morning')"
              >
                <div
                  v-for="(item, idx) in getMorningItems(expandedDayIdx)"
                  :key="item.id || `${expandedDayIdx}-morning-${idx}`"
                  class="scheduled-item"
                  :class="{ 'is-recommendation': item.is_recommendation, 'is-locked': item.is_locked }"
                  :draggable="!item.is_locked"
                  @dragstart="onProductDragStart($event, item, expandedDayIdx, 'morning')"
                >
                  <div class="item-content">
                    <span class="index">{{ idx + 1 }}</span>
                    <span class="name">{{ item.product_name }}</span>
                  </div>
                  <button
                    @click="toggleItemLock(item)"
                    class="btn-lock"
                    :title="item.is_locked ? '解鎖（AI 可調整）' : '鎖定（AI 不會移動/刪除）'"
                  >{{ item.is_locked ? '🔒' : '🔓' }}</button>
                  <button @click="removeItem(expandedDayIdx, 'morning', item.product_name)" class="btn-remove">×</button>
                </div>
              </div>
            </div>

            <!-- 晚間排程 -->
            <div class="time-slot evening">
              <div class="time-label">🌙 晚間</div>
              <div
                class="drop-zone"
                @dragover.prevent
                @drop="onProductDrop($event, expandedDayIdx, 'evening')"
              >
                <div
                  v-for="(item, idx) in getEveningItems(expandedDayIdx)"
                  :key="item.id || `${expandedDayIdx}-evening-${idx}`"
                  class="scheduled-item"
                  :class="{ 'is-recommendation': item.is_recommendation, 'is-locked': item.is_locked }"
                  :draggable="!item.is_locked"
                  @dragstart="onProductDragStart($event, item, expandedDayIdx, 'evening')"
                >
                  <div class="item-content">
                    <span class="index">{{ idx + 1 }}</span>
                    <span class="name">{{ item.product_name }}</span>
                  </div>
                  <button
                    @click="toggleItemLock(item)"
                    class="btn-lock"
                    :title="item.is_locked ? '解鎖（AI 可調整）' : '鎖定（AI 不會移動/刪除）'"
                  >{{ item.is_locked ? '🔒' : '🔓' }}</button>
                  <button @click="removeItem(expandedDayIdx, 'evening', item.product_name)" class="btn-remove">×</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作按鈕 -->
      <div class="footer">
        <button @click="saveChanges" class="btn-save" :disabled="savingOrder">
          {{ savingOrder ? '💾 保存中...' : '💾 保存排序' }}
        </button>
        <button @click="resetSchedule" class="btn-reset">
          🔄 重設
        </button>
        <span v-if="saveMessage" class="save-message" :class="{ success: saveSuccess }">
          {{ saveMessage }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCreateRoutine } from '~/composables/useCreateRoutine';
import { AVAILABLE_ROUTINE_THEMES } from '~/types/routine';
import type { RoutineItem, CabinetProductItem } from '~/types/routine';
import { PRODUCT_CATEGORIES, normalizeProductCategory } from '~/utils/productCategories';

// ==================
// 使用 Composable 和 Store
// ==================
const { routine } = useCreateRoutine();
const route = useRoute();
const router = useRouter();
const routineId = route.params.id as string;

const categoryOptions = PRODUCT_CATEGORIES;

// ==================
// 頁面狀態
// ==================
const pageLoading = ref(true);
const pageError = ref<string | null>(null);
const savingOrder = ref(false);
const saveMessage = ref<string | null>(null);
const saveSuccess = ref(false);
const selectedCategoryFilter = ref<string>('ALL');
const routineNameDraft = ref('');
const routineDescriptionDraft = ref('');
const savingMeta = ref(false);
const showThemeEditor = ref(false);
const showRecommendations = ref(true);
const aiSuggestedItems = ref<RoutineItem[]>([]);

const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];

// 手風琴展開：預設展開今天（0=週日），其餘收合
const expandedDayIdx = ref(new Date().getDay());

// ==================
// 可拖拽的產品列表（保養品庫存）
// ==================
const availableProducts = ref<CabinetProductItem[]>([]);

// ==================
// 排程主題選擇
// ==================
const selectedThemes = ref<string[]>([]); // 選擇的預設主題
const selectedCustomThemes = ref<string[]>([]); // 自定義主題
const currentCustomTheme = ref<string>(''); // 當前輸入的自定義主題

// ==================
// 計算屬性
// ==================

/**
 * 取得所有建議添購項目
 */
const recommendationItems = computed(() => {
  if (!routine.value) return [];
  return routine.value.items.filter(item => item.is_recommendation === true);
});

const recommendationSource = computed(() => [
  ...recommendationItems.value,
  ...aiSuggestedItems.value
]);

const normalizeCategory = (category?: string) => normalizeProductCategory(category);

const toDisplayCategory = (category?: string) => normalizeCategory(category);

const filteredAvailableProducts = computed(() => {
  if (selectedCategoryFilter.value === 'ALL') return availableProducts.value;
  return availableProducts.value.filter(
    product => normalizeCategory(product.product_category) === selectedCategoryFilter.value
  );
});

const selectedThemeTags = computed(() => {
  const sourceThemes = selectedThemes.value.length > 0
    ? selectedThemes.value
    : (Array.isArray(routine.value?.themes) ? routine.value!.themes : []);

  const sourceCustomThemes = selectedCustomThemes.value.length > 0
    ? selectedCustomThemes.value
    : (Array.isArray(routine.value?.custom_themes) ? routine.value!.custom_themes : []);

  const predefined = sourceThemes
    .map((themeId) => AVAILABLE_ROUTINE_THEMES.find(theme => theme.id === themeId)?.label || themeId)
    .map(label => String(label || '').trim())
    .filter(Boolean);

  const custom = sourceCustomThemes
    .map(theme => String(theme || '').trim())
    .filter(Boolean);

  return Array.from(new Set([...predefined, ...custom]));
});

const missingCategories = computed(() => {
  const existing = new Set(availableProducts.value.map(p => normalizeCategory(p.product_category)));
  return categoryOptions.filter(cat => cat !== '其他' && !existing.has(cat));
});

const extractReasonIngredients = (reason?: string): string[] => {
  const text = String(reason || '').trim();
  if (!text) return [];

  return text
    .replace(/[：:]/g, ' ')
    .split(/[、,，/\s]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2 && token.length <= 20)
    .slice(0, 5);
};

const unifiedRecommendations = computed(() => {
  const map = new Map<string, { productName: string; ingredients: Set<string> }>();

  for (const category of missingCategories.value) {
    if (!map.has(category)) {
      map.set(category, {
        productName: category,
        ingredients: new Set<string>()
      });
    }
  }

  for (const item of recommendationSource.value) {
    const category = normalizeCategory(item.product_category) || '其他';
    const displayName = String(item.product_name || '').trim() || category;

    if (!map.has(category)) {
      map.set(category, {
        productName: displayName,
        ingredients: new Set<string>()
      });
    }

    const target = map.get(category);
    if (!target) continue;

    for (const ingredient of Array.isArray(item.ingredients) ? item.ingredients : []) {
      const value = String(ingredient || '').trim();
      if (value) target.ingredients.add(value);
    }

    for (const ingredient of extractReasonIngredients(item.recommendation_reason)) {
      target.ingredients.add(ingredient);
    }
  }

  return Array.from(map.entries()).map(([category, value]) => {
    const ingredients = Array.from(value.ingredients).slice(0, 6);
    return {
      category,
      productName: value.productName,
      ingredients,
      ingredientsText: ingredients.length > 0 ? `推薦成分 ${ingredients.join('、')}` : '建議補齊此品類'
    };
  });
});

const OPTIONAL_CATEGORIES = new Set(['其他', '面膜', '眼霜']);

const USAGE_ORDER = [
  { category: '洗臉產品', timing: '早晚', tip: '清潔第一步，溫和帶走污垢' },
  { category: '化妝水', timing: '早晚', tip: '補水收斂，幫助後續成分吸收' },
  { category: '精華液', timing: '早晚', tip: '集中護理，針對肌膚問題' },
  { category: '眼霜', timing: '早晚', tip: '在乳液前使用，輕拍至吸收' },
  { category: '乳液', timing: '早晚', tip: '鎖水保濕，封住前一步驟成分' },
  { category: '面膜', timing: '晚間', tip: '建議 1–3 次/週，可替換精華步驟' },
  { category: '防曬', timing: '早晨', tip: '日間最後一步，需均勻補擦' },
] as const;

const isProductsSufficient = computed(() => {
  if (availableProducts.value.length === 0) return false;
  const coreCategories = (categoryOptions as readonly string[]).filter(c => !OPTIONAL_CATEGORIES.has(c));
  const missingCore = missingCategories.value.filter(c => !OPTIONAL_CATEGORIES.has(c));
  return missingCore.length === 0 && coreCategories.length > 0;
});

const usageOrderTips = computed(() => {
  const existing = new Set(availableProducts.value.map(p => normalizeCategory(p.product_category)));
  return USAGE_ORDER
    .filter(item => existing.has(item.category))
    .map((item, i) => ({ ...item, step: i + 1 }));
});

const loadTempRecommendations = () => {
  if (typeof window === 'undefined') return;
  const key = `routine-ai-recommendations:${routineId}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      aiSuggestedItems.value = parsed.map((item: any): RoutineItem => ({
        day_of_week: 0,
        time_of_day: 'morning' as const,
        sequence_order: 0,
        product_name: String(item?.product_name || '').trim(),
        product_category: item?.product_category,
        ingredients: Array.isArray(item?.ingredients) ? item.ingredients : [],
        is_recommendation: true,
        recommendation_reason: item?.recommendation_reason || 'AI 推薦候選品項'
      })).filter(item => !!item.product_name);
    }
  } catch {
    aiSuggestedItems.value = [];
  } finally {
    sessionStorage.removeItem(key);
  }
};

const loadRoutineById = async () => {
  const response = await $fetch<{
    success: boolean;
    data: any;
    message: string;
  }>(`/api/routines/${routineId}`);

  if (!response.success || !response.data) {
    throw new Error(response.message || '無法載入排程');
  }

  routine.value = response.data;

  if (!routine.value) {
    availableProducts.value = [];
    return;
  }

  resetRoutineMetaDraft();
  selectedThemes.value = Array.isArray(routine.value.themes) ? [...routine.value.themes] : [];
  selectedCustomThemes.value = Array.isArray(routine.value.custom_themes) ? [...routine.value.custom_themes] : [];
  availableProducts.value = Array.isArray(routine.value.all_products) ? routine.value.all_products : [];
};

/**
 * 取得指定日期的早晨排程項目
 */
const getMorningItems = (dayOfWeek: number) => {
  if (!routine.value) return [];
  return routine.value.items
    .filter(item => item.day_of_week === dayOfWeek && item.time_of_day === 'morning')
    .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
};

/**
 * 取得指定日期的晚間排程項目
 */
const getEveningItems = (dayOfWeek: number) => {
  if (!routine.value) return [];
  return routine.value.items
    .filter(item => item.day_of_week === dayOfWeek && item.time_of_day === 'evening')
    .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
};

// ==================
// 方法
// ==================

/**
 * 取得特定時段的所有項目
 */
const getItemsForTimeslot = (dayOfWeek: number, timeOfDay: 'morning' | 'evening'): RoutineItem[] => {
  if (!routine.value) return [];
  return routine.value.items.filter(
    item => item.day_of_week === dayOfWeek && item.time_of_day === timeOfDay
  );
};

/**
 * 移除排程項目
 */
const removeItem = (dayOfWeek: number, timeOfDay: 'morning' | 'evening', productName: string) => {
  if (!routine.value) return;

  const index = routine.value.items.findIndex(
    item =>
      item.day_of_week === dayOfWeek &&
      item.time_of_day === timeOfDay &&
      item.product_name === productName
  );

  if (index >= 0) {
    if (routine.value.items[index]?.is_locked) {
      saveSuccess.value = false;
      saveMessage.value = '🔒 此項目已鎖定，請先解鎖再移除';
      return;
    }

    routine.value.items.splice(index, 1);

    // 重新計算該時段的 sequence_order
    const itemsInSlot = getItemsForTimeslot(dayOfWeek, timeOfDay);
    itemsInSlot.forEach((item, idx) => {
      item.sequence_order = idx;
    });
  }
};

const goToAIPreferences = () => {
  router.push({
    path: '/routines/new',
    query: {
      action: 'regenerate',
      routineId
    }
  });
};

const goToAddProduct = (hint: string) => {
  router.push({
    path: '/',
    query: {
      from: 'routine',
      routineId,
      category: hint
    }
  });
};

const toggleItemLock = async (item: RoutineItem) => {
  if (!item.id) {
    saveSuccess.value = false;
    saveMessage.value = '❌ 尚未保存的項目不能鎖定，請先保存排序';
    return;
  }

  try {
    const next = !(item.is_locked === true);
    const response = await $fetch<{ success: boolean }>(`/api/routines/items/${item.id}/lock`, {
      method: 'PATCH',
      body: {
        is_locked: next
      }
    });

    if (response.success) {
      item.is_locked = next;
      saveSuccess.value = true;
      saveMessage.value = next ? '🔒 已鎖定，AI 不會調整此項目' : '🔓 已解鎖，AI 可重新安排';
    }
  } catch (err: any) {
    saveSuccess.value = false;
    saveMessage.value = `❌ 鎖定狀態更新失敗: ${err.data?.message || err.message || '未知錯誤'}`;
  }
};

/**
 * 將建議項目加入排程
 */
const moveToRoutine = (item: RoutineItem) => {
  if (!routine.value) return;

  // 添加到週一早晨（默認位置）
  const newItem: RoutineItem = {
    ...item,
    day_of_week: 1, // Monday
    time_of_day: 'morning',
    sequence_order: (getMorningItems(1).length)
  };

  routine.value.items.push(newItem);

  // 從建議中移除
  const idx = routine.value.items.findIndex(
    i => i.product_name === item.product_name && i.is_recommendation === true
  );
  if (idx >= 0 && routine.value.items[idx]) {
    routine.value.items[idx].is_recommendation = false;
  }

  const tempIdx = aiSuggestedItems.value.findIndex(
    i => (i.product_name || '').trim().toLowerCase() === (item.product_name || '').trim().toLowerCase()
  );
  if (tempIdx >= 0) {
    aiSuggestedItems.value.splice(tempIdx, 1);
  }
};

const resetRoutineMetaDraft = () => {
  if (!routine.value) return;
  routineNameDraft.value = String(routine.value.name || '');
  routineDescriptionDraft.value = String(routine.value.description || '');
};

const saveRoutineMeta = async () => {
  if (!routine.value || !routineId) return;

  const nextName = routineNameDraft.value.trim();
  if (!nextName) {
    saveSuccess.value = false;
    saveMessage.value = '❌ 排程名稱不可為空';
    return;
  }

  savingMeta.value = true;
  try {
    const response = await $fetch<{ success: boolean; data: { name: string; description: string | null } }>(
      `/api/routines/${routineId}/meta`,
      {
        method: 'PUT',
        body: {
          name: nextName,
          description: routineDescriptionDraft.value.trim()
        }
      }
    );

    if (!response.success) {
      throw new Error('更新排程資料失敗');
    }

    routine.value.name = response.data.name;
    routine.value.description = response.data.description || '';
    resetRoutineMetaDraft();

    saveSuccess.value = true;
    saveMessage.value = '✅ 排程名稱已更新';
  } catch (err: any) {
    saveSuccess.value = false;
    saveMessage.value = `❌ 更新失敗: ${err.data?.message || err.message || '未知錯誤'}`;
  } finally {
    savingMeta.value = false;
  }
};

/**
 * 保存排序更改
 */
const saveChanges = async () => {
  if (!routine.value || !routineId) return;

  savingOrder.value = true;
  saveMessage.value = null;

  try {
    // 準備更新數據（包含所有需要的欄位）
    const updates = routine.value.items.map(item => ({
      id: item.id,
      product_name: item.product_name,
      product_category: item.product_category,
      day_of_week: item.day_of_week,
      time_of_day: item.time_of_day,
      sequence_order: item.sequence_order ?? 0,
      ingredients: item.ingredients || [],
      is_recommendation: item.is_recommendation ?? false,
      is_locked: item.is_locked === true,
      recommendation_reason: item.recommendation_reason || null,
      notes: item.notes || null
    }));

    const response = await $fetch<{
      success: boolean;
      data: { updated_count: number; inserted_count: number };
      message: string;
    }>('/api/routines/update-order', {
      method: 'POST',
      body: {
        routine_id: routineId,
        updates
      }
    });

    if (response.success) {
      saveSuccess.value = true;
      saveMessage.value = `✅ ${response.message}`;

      setTimeout(() => {
        saveMessage.value = null;
        saveSuccess.value = false;
      }, 3000);
    } else {
      throw new Error(response.message);
    }
  } catch (err: any) {
    console.error('[Save Order Error]:', err);
    saveSuccess.value = false;
    saveMessage.value = `❌ 保存失敗: ${err.data?.message || err.message || '未知錯誤'}`;
  } finally {
    savingOrder.value = false;
  }
};

/**
 * 重設排程
 */
const resetSchedule = async () => {
  if (!confirm('確定要重設排程嗎？此操作無法撤銷。')) {
    return;
  }

  // 重新載入原始排程
  pageLoading.value = true;
  pageError.value = null;

  try {
    await loadRoutineById();
    saveSuccess.value = true;
    saveMessage.value = '✅ 已還原為最新已保存排程';
  } catch (err: any) {
    pageError.value = err.data?.message || err.message || '無法還原排程';
  } finally {
    pageLoading.value = false;
  }
};

/**
 * 前往保養品櫃添加產品
 */
const goToCabinet = () => {
  router.push({
    path: '/',
    query: {
      from: 'routine',
      routineId,
      source: 'empty-routine'
    }
  });
};

/**
 * 返回上一頁
 */
const goBack = () => {
  router.back();
};

// ==================
// 排程主題選擇方法
// ==================

/**
 * 檢查主題是否被選擇
 */
const isThemeSelected = (themeId: string): boolean => {
  return selectedThemes.value.includes(themeId);
};

/**
 * 切換主題選擇狀態
 */
const toggleTheme = (themeId: string) => {
  const idx = selectedThemes.value.indexOf(themeId);
  if (idx >= 0) {
    selectedThemes.value.splice(idx, 1);
  } else {
    selectedThemes.value.push(themeId);
  }
};

/**
 * 添加自定義主題
 */
const addCustomTheme = () => {
  const trimmed = currentCustomTheme.value.trim();
  if (trimmed && !selectedCustomThemes.value.includes(trimmed)) {
    selectedCustomThemes.value.push(trimmed);
    currentCustomTheme.value = '';
  }
};

/**
 * 移除自定義主題
 */
const removeCustomTheme = (idx: number) => {
  selectedCustomThemes.value.splice(idx, 1);
};

/**
 * 保存排程主題設定
 */
const saveThemes = async () => {
  if (!routine.value || !routineId) return;

  savingOrder.value = true;
  saveMessage.value = '💾 正在保存主題設定...';

  try {
    // 更新排程的主題
    routine.value.themes = selectedThemes.value;
    routine.value.custom_themes = selectedCustomThemes.value;

    // 調用 API 保存
    const response = await $fetch<any>('/api/routines/update-themes', {
      method: 'POST',
      body: {
        routine_id: routineId,
        themes: selectedThemes.value,
        custom_themes: selectedCustomThemes.value
      }
    });

    if (response.success) {
      saveSuccess.value = true;
      saveMessage.value = '✅ 主題設定已保存';

      setTimeout(() => {
        saveMessage.value = null;
        saveSuccess.value = false;
      }, 3000);
    } else {
      throw new Error(response.message);
    }
  } catch (err: any) {
    console.error('[Save Themes Error]:', err);
    saveSuccess.value = false;
    saveMessage.value = `❌ 保存失敗: ${err.data?.message || err.message || '未知錯誤'}`;
  } finally {
    savingOrder.value = false;
  }
};

// ==================
// 拖拽事件處理
// ==================
let draggedProduct: CabinetProductItem | RoutineItem | null = null;
let draggedFromInventory = false;

/**
 * 從庫存開始拖拽
 */
const onInventoryDragStart = (evt: DragEvent, product: CabinetProductItem) => {
  draggedProduct = product;
  draggedFromInventory = true;
  if (evt.dataTransfer) {
    evt.dataTransfer.effectAllowed = 'move';
    evt.dataTransfer.setData('product', JSON.stringify(product));
  }
};

/**
 * 從時間段開始拖拽（用於重新排序）
 */
const onProductDragStart = (evt: DragEvent, item: RoutineItem, dayIdx: number, timeOfDay: 'morning' | 'evening') => {
  if (item.is_locked) {
    evt.preventDefault();
    return;
  }

  draggedProduct = item;
  draggedFromInventory = false;
  if (evt.dataTransfer) {
    evt.dataTransfer.effectAllowed = 'move';
    evt.dataTransfer.setData('product', JSON.stringify(item));
  }
};

/**
 * 放入時間段
 */
const onProductDrop = (evt: DragEvent, dayIdx: number, timeOfDay: 'morning' | 'evening') => {
  evt.preventDefault();
  if (!draggedProduct || !routine.value) return;

  const productName = draggedFromInventory 
    ? (draggedProduct as CabinetProductItem).product_name
    : (draggedProduct as RoutineItem).product_name;

  // 檢查目標時段是否已經有相同的產品
  const targetSlotHasDuplicate = routine.value.items.some(
    item =>
      item.product_name === productName &&
      item.day_of_week === dayIdx &&
      item.time_of_day === timeOfDay
  );

  if (targetSlotHasDuplicate) {
    // 同一時段已有相同產品，無法放置
    console.warn(`[拖拽] ${productName} 已在本時段存在，無法重複放置`);
    draggedProduct = null;
    draggedFromInventory = false;
    return;
  }

  if (draggedFromInventory) {
    // 從庫存新增到排程（檢查後添加，不重複）
    const sequenceOrder = getItemsForTimeslot(dayIdx, timeOfDay).length;

    const newItem: RoutineItem = {
      product_name: (draggedProduct as CabinetProductItem).product_name,
      product_category: (draggedProduct as CabinetProductItem).product_category,
      day_of_week: dayIdx,
      time_of_day: timeOfDay,
      sequence_order: sequenceOrder,
      is_recommendation: false
    };

    routine.value.items.push(newItem);
  } else {
    // 在排程內拖拽（移動產品，自動刪除原位置）
    const draggedRoutineItem = draggedProduct as RoutineItem;

    if (draggedRoutineItem.is_locked) {
      saveSuccess.value = false;
      saveMessage.value = '🔒 此項目已鎖定，無法拖拽移動';
      draggedProduct = null;
      draggedFromInventory = false;
      return;
    }
    
    // 尋找原始項目
    const sourceItemIndex = routine.value.items.findIndex(
      item =>
        item.product_name === draggedRoutineItem.product_name &&
        item.day_of_week === draggedRoutineItem.day_of_week &&
        item.time_of_day === draggedRoutineItem.time_of_day
    );

    if (sourceItemIndex >= 0) {
      const sourceItem = routine.value.items[sourceItemIndex];

      // 確保 sourceItem 存在
      if (!sourceItem) return;

      // 如果拖拽到同一日期、同一時間段，不做任何操作
      if (sourceItem.day_of_week === dayIdx && sourceItem.time_of_day === timeOfDay) {
        draggedProduct = null;
        draggedFromInventory = false;
        return;
      }

      // 移動產品：先刪除原位置
      routine.value.items.splice(sourceItemIndex, 1);

      // 重新計算原時段的 sequence_order
      const oldTimeSlot = getItemsForTimeslot(sourceItem.day_of_week, sourceItem.time_of_day);
      oldTimeSlot.forEach((item, idx) => {
        item.sequence_order = idx;
      });

      // 添加到新位置
      const newSequenceOrder = getItemsForTimeslot(dayIdx, timeOfDay).length;
      
      const movedItem: RoutineItem = {
        ...sourceItem,
        product_name: sourceItem.product_name || '',
        day_of_week: dayIdx,
        time_of_day: timeOfDay,
        sequence_order: newSequenceOrder
      };

      routine.value.items.push(movedItem);

      // 重新計算新位置所在時段的 sequence_order
      const targetTimeSlot = getItemsForTimeslot(dayIdx, timeOfDay);
      targetTimeSlot.forEach((item, idx) => {
        item.sequence_order = idx;
      });
    }
  }

  draggedProduct = null;
  draggedFromInventory = false;
};

// ==================
// 生命週期
// ==================
onMounted(async () => {
  pageLoading.value = true;
  pageError.value = null;

  if (route.query.regenResult === 'recommended') {
    const recCount = typeof route.query.recCount === 'string' ? route.query.recCount : '0';
    loadTempRecommendations();
    saveSuccess.value = true;
    saveMessage.value = `✅ 已產生 ${recCount} 項 AI 推薦，排程未自動變更，請由您手動加入`;
  } else if (route.query.regenResult === 'updated' || route.query.regenResult === 'kept') {
    const changed = typeof route.query.changed === 'string' ? route.query.changed : '0';
    const threshold = typeof route.query.threshold === 'string' ? route.query.threshold : '3';
    saveSuccess.value = true;
    saveMessage.value = route.query.regenResult === 'updated'
      ? `✅ AI 已更新排程（變動 ${changed}）`
      : `✅ 變動不大（${changed}/${threshold}），保留原排程`;
  } else if (route.query.cabinetUpdated === '1') {
    saveSuccess.value = true;
    saveMessage.value = '✅ 已新增產品到保養品櫃，請手動點擊「AI 重新排成」更新排程';
  }

  try {
    await loadRoutineById();
  } catch (err: any) {
    console.error('[Onmount Error]:', err);
    pageError.value = err.data?.message || err.message || '載入排程失敗';
  } finally {
    pageLoading.value = false;
  }
});
</script>

<style scoped>
.schedule-page {
  min-height: 100vh;
  padding: var(--space-6) var(--space-5);
  max-width: 1200px;
  margin: 0 auto;
}

/* Header */
.header {
  margin: 0 auto var(--space-6);
  text-align: center;
}

.header h1 {
  font-family: var(--font-heading);
  font-size: 26px;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-4);
}

.routine-meta-editor {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.meta-name-input,
.meta-description-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.6rem 0.75rem;
  font-size: 15px;
  font-family: var(--font-body);
  background: var(--color-surface);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.meta-name-input { font-weight: 600; font-size: 16px; }

.meta-name-input:focus,
.meta-description-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.meta-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.btn-save-meta {
  padding: 6px 16px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.18s;
}

.btn-save-meta:hover:not(:disabled) { background: var(--color-accent-hover); }
.btn-save-meta:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-reset-meta {
  padding: 6px 14px;
  background: var(--color-surface-alt);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
}

.theme-merge-toggle {
  border: 1px solid var(--color-sage);
  background: var(--color-sage-light);
  color: var(--color-sage);
  border-radius: var(--radius-md);
  padding: 6px 14px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s;
}

.theme-merge-toggle:hover { background: #D8ECD8; }

.themes-section.inline-merged {
  margin-bottom: 0;
  text-align: left;
}

/* Mode toggle */
.mode-toggle {
  margin: 0 auto var(--space-6);
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.mode-btn {
  padding: 8px 20px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.18s;
}

.mode-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.mode-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.mode-btn.ai-regenerate {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.mode-btn.ai-regenerate:hover:not(:disabled) {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}

/* Loading */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(58, 50, 45, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.spinner {
  width: 44px; height: 44px;
  border: 3px solid rgba(160, 112, 96, 0.3);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  margin-bottom: var(--space-4);
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-overlay p { color: #fff; font-size: 15px; font-weight: 500; margin: 0; }

/* Error banner */
.error-banner {
  padding: var(--space-3) var(--space-4);
  background: var(--color-red-light);
  border: 1px solid #E8C0C0;
  border-radius: var(--radius-md);
  color: #9A4A4A;
  font-weight: 500;
  margin-bottom: var(--space-5);
}

.content { /* no wrapper needed — schedule-page is the max-width container */ }

/* Empty routine alert */
.empty-routine-alert {
  background: var(--color-accent-light);
  border: 2px solid #D8B8B0;
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-6);
  margin-bottom: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.alert-icon { font-size: 2.5rem; flex-shrink: 0; }

.alert-content { flex: 1; text-align: left; }

.alert-content h2 {
  font-family: var(--font-heading);
  font-size: 20px;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2);
}

.alert-message {
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-5);
  font-size: 14px;
  line-height: 1.6;
}

.alert-actions { display: flex; gap: var(--space-3); flex-wrap: wrap; }

.btn-primary {
  padding: 8px 20px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  transition: background 0.18s;
}

.btn-primary:hover { background: var(--color-accent-hover); }

.btn-secondary {
  padding: 8px 20px;
  background: var(--color-surface);
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  transition: background 0.18s;
}

.btn-secondary:hover { background: var(--color-accent-light); }

/* Recommendations section */
/* Usage tips (sufficient products) */
.usage-tips-section {
  margin-bottom: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
}

.usage-tips-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-light);
}

.usage-tips-header h3 {
  margin: 0;
  font-size: 16px;
  font-family: var(--font-heading);
  color: var(--color-text-primary);
}

.sufficient-badge {
  display: inline-block;
  background: var(--color-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  white-space: nowrap;
}

.usage-steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.usage-step {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
}

.step-number {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-body {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: 14px;
}

.step-cat { color: var(--color-text-primary); font-weight: 600; }

.step-timing {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-accent-light);
  color: var(--color-accent);
  font-weight: 500;
  white-space: nowrap;
}

.step-note {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.recommendations-section {
  margin-bottom: var(--space-6);
  background: var(--color-amber-light);
  border: 1px solid #DDB880;
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.recommendations-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid #DDB880;
}

.recommendation-tools { display: flex; align-items: center; gap: var(--space-3); }

.header-left h2 {
  font-family: var(--font-heading);
  color: var(--color-amber);
  margin: 0 0 4px;
  font-size: 18px;
}

.header-subtitle { color: #8A6030; font-size: 13px; margin: 0; }

.recommendation-count {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-amber);
  color: #fff;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-weight: 700;
}

.count-badge { font-size: 1.3rem; }
.count-label { font-size: 12px; }

.recommendation-toggle {
  border: 1px solid var(--color-amber);
  background: var(--color-surface);
  color: #8A6030;
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  transition: background 0.15s;
}

.recommendation-toggle:hover { background: var(--color-amber-light); }
.recommendation-toggle:focus-visible { outline: 2px solid var(--color-amber); outline-offset: 2px; }

.recommendation-list { display: flex; flex-direction: column; }

.missing-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px dashed var(--color-border);
}

.missing-item-row:last-child { border-bottom: none; }
.recommendation-row { align-items: center; }

.rec-text { flex: 1; color: var(--color-text-primary); font-size: 14px; line-height: 1.5; }
.rec-text strong { color: var(--color-amber); }

.add-link-btn {
  flex-shrink: 0;
  border: 1px solid var(--color-accent);
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: var(--radius-pill);
  padding: 3px 10px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  transition: background 0.15s;
  white-space: nowrap;
}

.add-link-btn:hover { background: #EAD8D0; }

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.recommendation-card {
  background: var(--color-surface);
  border: 1px solid #DDB880;
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: box-shadow 0.18s;
  display: flex;
  flex-direction: column;
}

.recommendation-card:hover { box-shadow: var(--shadow-md); }

.recommendation-card .card-header {
  background: var(--color-amber-light);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border-bottom: 1px solid #DDB880;
}

.recommendation-card .card-header .icon { font-size: 1.3rem; flex-shrink: 0; }
.recommendation-card .card-header .ingredient-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
.recommendation-card .card-footer { padding: var(--space-3) var(--space-4); background: transparent; }

.btn-add {
  width: 100%;
  padding: 8px;
  background: var(--color-amber);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s;
}

.btn-add:hover { background: #AA8050; }

.recommendations-info {
  background: rgba(196, 154, 106, 0.1);
  border-left: 3px solid var(--color-amber);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: #7A5A30;
  margin-top: var(--space-3);
}

.recommendations-info p { margin: 0; line-height: 1.6; }

.recommendations-collapsed-note {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(196, 154, 106, 0.08);
  border: 1px dashed #DDB880;
  color: #8A6030;
  font-size: 13px;
}

.recommendations-collapsed-note p { margin: 0; }

/* Themes section */
.themes-section {
  margin-bottom: var(--space-6);
  background: var(--color-sage-light);
  border: 1px solid #C0D8C2;
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.themes-header {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid #C0D8C2;
}

.themes-header h2 { color: var(--color-sage); margin: 0 0 4px; font-size: 18px; }
.themes-subtitle { color: #5A7A60; font-size: 13px; margin: 0; }

.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.theme-checkbox {
  background: var(--color-surface);
  border: 1px solid #C0D8C2;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
}

.theme-checkbox:hover { border-color: var(--color-sage); }
.theme-checkbox:focus-visible { outline: 2px solid var(--color-sage); outline-offset: 2px; }

.theme-checkbox.selected {
  background: #D8ECD8;
  border-color: var(--color-sage);
}

.theme-icon { font-size: 1.5rem; flex-shrink: 0; }
.theme-info { flex: 1; }
.theme-label { font-weight: 600; font-size: 13px; color: var(--color-text-primary); margin-bottom: 2px; }
.theme-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.4; }

.checkmark {
  position: absolute;
  top: 6px; right: 6px;
  width: 20px; height: 20px;
  background: var(--color-sage);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.custom-themes {
  background: var(--color-surface);
  border: 1px solid #C0D8C2;
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.custom-themes label { display: block; font-size: 13px; font-weight: 500; color: var(--color-sage); margin-bottom: var(--space-3); }

.custom-input-group { display: flex; gap: var(--space-3); margin-bottom: var(--space-3); }

.custom-input-group input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 14px;
  outline: none;
  transition: border-color 0.18s;
}

.custom-input-group input:focus { border-color: var(--color-sage); box-shadow: 0 0 0 3px var(--color-sage-light); }

.btn-add-theme {
  padding: 8px 16px;
  background: var(--color-sage);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.15s;
}

.btn-add-theme:hover { background: #6A8A70; }

.custom-themes-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }

.custom-theme-badge {
  background: var(--color-sage);
  color: #fff;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  font-weight: 500;
}

.btn-remove {
  background: rgba(255,255,255,0.3);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 18px; height: 18px;
  padding: 0;
  cursor: pointer;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.btn-remove:hover { background: rgba(255,255,255,0.5); }

.btn-save-themes {
  width: 100%;
  padding: 10px 16px;
  background: var(--color-sage);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  transition: background 0.18s;
}

.btn-save-themes:hover { background: #6A8A70; }
.btn-save-themes:disabled { opacity: 0.5; cursor: not-allowed; }

/* Main grid */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  margin-bottom: var(--space-5);
  align-items: start;
}

.section {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.section h2 {
  font-family: var(--font-heading);
  font-size: 17px;
  color: var(--color-text-primary);
  margin-top: 0;
  margin-bottom: var(--space-2);
}

.routine-theme-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 var(--space-4);
}

.theme-tags-label { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; }

.theme-tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid #C0D8C2;
  background: var(--color-sage-light);
  color: var(--color-sage);
  font-size: 11px;
  font-weight: 600;
}

.theme-tag-empty { font-size: 12px; color: var(--color-text-muted); }

.note { color: var(--color-text-muted); font-size: 13px; margin-bottom: var(--space-3); }

.filter-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.filter-row label { font-size: 13px; color: var(--color-text-secondary); margin: 0; }

.category-filter-select {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 5px 8px;
  font-family: var(--font-body);
  font-size: 13px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  outline: none;
}

.category-filter-select:focus { border-color: var(--color-accent); }

/* Product inventory */
.left-panel .product-list {
  min-height: 400px;
  background: var(--color-surface-alt);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.product-item {
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: move;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.15s, transform 0.15s;
  user-select: none;
}

.product-item:hover { background: var(--color-accent-light); transform: translateX(2px); }

.product-item.is-recommendation {
  border-color: var(--color-amber);
  background: var(--color-amber-light);
}

.product-item .badge {
  background: var(--color-amber);
  color: #fff;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  margin-left: var(--space-2);
}

.product-category-tag {
  background: var(--color-gold-light);
  color: var(--color-gold);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
  font-size: 11px;
  margin-left: auto;
  margin-right: var(--space-2);
}

.empty-inventory {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Day tabs */
.day-tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
}

.day-tab {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-alt);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-family: var(--font-body);
  font-weight: 500;
  min-width: 36px;
  text-align: center;
  transition: background 0.15s, border-color 0.15s;
}

.day-tab:hover:not(.active) {
  background: var(--color-border-light);
  border-color: var(--color-text-muted);
}

.day-tab.active {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.tab-count {
  display: inline-block;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  font-size: 10px;
  padding: 0 4px;
  margin-left: 3px;
  font-weight: 700;
}

.day-tab:not(.active) .tab-count {
  background: var(--color-accent);
  color: #fff;
}

.day-view {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  overflow: hidden;
}

.day-content { padding: var(--space-2); }

.time-slot {
  border-bottom: 1px solid var(--color-border-light);
  padding: var(--space-2) var(--space-3);
}

.time-slot:last-child { border-bottom: none; }

.time-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
}

.drop-zone {
  min-height: 70px;
  background: var(--color-surface);
  border: 2px dashed var(--color-accent);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: background 0.15s, border-color 0.15s;
}

.drop-zone:hover { background: var(--color-accent-light); }

.scheduled-item {
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 12px;
  cursor: move;
  transition: background 0.15s;
  border: 1px solid var(--color-border-light);
}

.scheduled-item:hover { background: var(--color-border-light); }

.scheduled-item.is-recommendation {
  background: var(--color-amber-light);
  border-left: 2px solid var(--color-amber);
}

.scheduled-item.is-locked {
  border-left: 2px solid var(--color-gold);
  background: var(--color-gold-light);
}

.btn-lock {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  padding: 1px 3px;
}

.btn-lock:hover { transform: scale(1.1); }

.item-content { display: flex; align-items: center; gap: var(--space-2); flex: 1; min-width: 0; }
.item-content .index { font-weight: 700; color: var(--color-text-muted); min-width: 18px; font-size: 11px; }
.item-content .name { flex: 1; color: var(--color-text-primary); word-break: break-word; }

.btn-remove {
  background: var(--color-red);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
  min-width: 22px;
}

.btn-remove:hover { background: #9A5252; }
.btn-remove:disabled { background: var(--color-text-muted); cursor: not-allowed; }

/* Footer */
.footer {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.btn-save {
  padding: 10px 24px;
  background: var(--color-sage);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 500;
  transition: background 0.18s;
}

.btn-save:hover:not(:disabled) { background: #6A8A70; }
.btn-save:disabled { background: var(--color-text-muted); cursor: not-allowed; }

.btn-reset {
  padding: 10px 20px;
  background: var(--color-surface-alt);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 15px;
  transition: background 0.15s;
}

.btn-reset:hover { background: var(--color-border-light); }

.save-message {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-red);
}

.save-message.success { color: var(--color-sage); }

/* Responsive */
@media (max-width: 1024px) {
  .main-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .schedule-page { padding: var(--space-4) var(--space-3); }
  .section { padding: var(--space-4); }
  .footer { flex-direction: column; }
  .save-message { margin: 0; }

  /* 推薦區塊手機版縮小 */
  .recommendations-section {
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-4);
  }
  .recommendations-header {
    margin-bottom: var(--space-2);
    padding-bottom: var(--space-2);
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .header-left h2 { font-size: 14px; }
  .header-subtitle { font-size: 12px; }
  .recommendation-count { padding: 3px 8px; }
  .count-badge { font-size: 0.95rem; }
  .count-label { font-size: 11px; }
  .recommendation-toggle { padding: 3px 10px; font-size: 11px; }
  .recommendations-collapsed-note { margin-top: var(--space-2); }
}

.fade-enter-active, .fade-leave-active { transition: all 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-10px); }
.drag { opacity: 0.5; }
</style>
