<template>
  <div class="schedule-container">
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

          <div class="days-grid">
            <div v-for="(dayName, dayIdx) in daysOfWeek" :key="dayIdx" class="day-column">
              <div class="day-header">
                <h3>{{ dayName }}</h3>
              </div>

              <!-- 早晨排程 -->
              <div class="time-slot morning">
                <div class="time-label">🌅 早晨</div>
                <div
                  class="drop-zone"
                  @dragover.prevent
                  @drop="onProductDrop($event, dayIdx, 'morning')"
                >
                  <div
                    v-for="(item, idx) in getMorningItems(dayIdx)"
                    :key="item.id || `${dayIdx}-morning-${idx}`"
                    class="scheduled-item"
                    :class="{ 'is-recommendation': item.is_recommendation, 'is-locked': item.is_locked }"
                    :draggable="!item.is_locked"
                    @dragstart="onProductDragStart($event, item, dayIdx, 'morning')"
                  >
                    <div class="item-content">
                      <span class="index">{{ idx + 1 }}</span>
                      <span class="name">{{ item.product_name }}</span>
                    </div>
                    <button
                      @click="toggleItemLock(item)"
                      class="btn-lock"
                      :title="item.is_locked ? '解鎖（AI 可調整）' : '鎖定（AI 不會移動/刪除）'"
                    >
                      {{ item.is_locked ? '🔒' : '🔓' }}
                    </button>
                    <button
                      @click="removeItem(dayIdx, 'morning', item.product_name)"
                      class="btn-remove"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <!-- 晚間排程 -->
              <div class="time-slot evening">
                <div class="time-label">🌙 晚間</div>
                <div
                  class="drop-zone"
                  @dragover.prevent
                  @drop="onProductDrop($event, dayIdx, 'evening')"
                >
                  <div
                    v-for="(item, idx) in getEveningItems(dayIdx)"
                    :key="item.id || `${dayIdx}-evening-${idx}`"
                    class="scheduled-item"
                    :class="{ 'is-recommendation': item.is_recommendation, 'is-locked': item.is_locked }"
                    :draggable="!item.is_locked"
                    @dragstart="onProductDragStart($event, item, dayIdx, 'evening')"
                  >
                    <div class="item-content">
                      <span class="index">{{ idx + 1 }}</span>
                      <span class="name">{{ item.product_name }}</span>
                    </div>
                    <button
                      @click="toggleItemLock(item)"
                      class="btn-lock"
                      :title="item.is_locked ? '解鎖（AI 可調整）' : '鎖定（AI 不會移動/刪除）'"
                    >
                      {{ item.is_locked ? '🔒' : '🔓' }}
                    </button>
                    <button
                      @click="removeItem(dayIdx, 'evening', item.product_name)"
                      class="btn-remove"
                    >
                      ×
                    </button>
                  </div>
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

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  return categoryOptions.filter(cat => !existing.has(cat));
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
.schedule-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  max-width: 1400px;
  margin: 0 auto 2rem;
  text-align: center;
}

.header h1 {
  color: #2c3e50;
  font-size: 2.5rem;
  margin: 0 0 0.5rem;
}

.routine-meta-editor {
  max-width: 720px;
  margin: 0.5rem auto 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.meta-name-input,
.meta-description-input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
  background: #fff;
}

.meta-name-input {
  font-weight: 700;
  font-size: 1rem;
  color: #1f2937;
}

.meta-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
}

.btn-save-meta,
.btn-reset-meta {
  border: none;
  border-radius: 6px;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  font-weight: 700;
}

.btn-save-meta {
  background: #2563eb;
  color: #fff;
}

.btn-save-meta:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-reset-meta {
  background: #e2e8f0;
  color: #334155;
}

.theme-merge-toggle {
  border: 1px solid #16a34a;
  background: #ecfdf3;
  color: #166534;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-weight: 700;
}

.themes-section.inline-merged {
  margin-bottom: 0;
  text-align: left;
}

.mode-toggle {
  max-width: 1400px;
  margin: 0 auto 2rem;
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.mode-btn {
  padding: 0.75rem 1.5rem;
  border: 2px solid #bdc3c7;
  background: white;
  color: #2c3e50;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
  font-size: 1rem;
}

.mode-btn:hover {
  border-color: #3498db;
  background: #ecf0f1;
}

.mode-btn.active {
  background: #3498db;
  color: white;
  border-color: #3498db;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.mode-btn.ai-regenerate {
  background: linear-gradient(135deg, #2980b9 0%, #3498db 100%);
  color: white;
  border-color: #2980b9;
}

.mode-btn.ai-regenerate:hover:not(:disabled) {
  border-color: #1a5c8e;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
}

.mode-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(52, 152, 219, 0.3);
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-banner {
  max-width: 1400px;
  margin: 0 auto 2rem;
  padding: 1rem;
  background: #fadbd8;
  border: 2px solid #e74c3c;
  border-radius: 8px;
  color: #c0392b;
  font-weight: 600;
}

.content {
  max-width: 1400px;
  margin: 0 auto;
}

/* 空排程提示區塊 */
.empty-routine-alert {
  background: linear-gradient(135deg, #e8f4f8 0%, #f0f8ff 100%);
  border: 3px solid #3498db;
  border-radius: 12px;
  padding: 2.5rem;
  text-align: center;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  box-shadow: 0 4px 16px rgba(52, 152, 219, 0.15);
}

.alert-icon {
  font-size: 3rem;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
  text-align: left;
}

.alert-content h2 {
  color: #2c3e50;
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.alert-message {
  color: #555;
  margin: 0.5rem 0 1.5rem;
  font-size: 0.95rem;
  line-height: 1.6;
}

.alert-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 0.7rem 1.5rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
}

.btn-secondary {
  padding: 0.7rem 1.5rem;
  background: white;
  color: #3498db;
  border: 2px solid #3498db;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.btn-secondary:hover {
  background: #ecf0f1;
}

/* 建議添購區塊 */
.recommendations-section {
  margin-bottom: 3rem;
  background: linear-gradient(135deg, #fff9e6 0%, #fffaed 100%);
  border: 3px solid #f39c12;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 6px 20px rgba(243, 156, 18, 0.15);
  position: relative;
  overflow: hidden;
}

.recommendations-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #f39c12, #e67e22, #d68910);
  animation: gradientShift 3s ease-in-out infinite;
}

@keyframes gradientShift {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.recommendations-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f39c12;
}

.recommendation-tools {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.header-left h2 {
  color: #d68910;
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.header-subtitle {
  color: #b8860b;
  font-size: 0.9rem;
  margin: 0;
  font-weight: 500;
}

.recommendation-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f39c12;
  color: white;
  padding: 0.75rem 1.25rem;
  border-radius: 25px;
  font-weight: 700;
}

.count-badge {
  font-size: 1.5rem;
}

.count-label {
  font-size: 0.85rem;
}

.recommendation-toggle {
  border: 1px solid #f59e0b;
  background: #fff;
  color: #92400e;
  border-radius: 999px;
  padding: 0.42rem 0.8rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
}

.recommendation-toggle:hover {
  background: #fffbeb;
}

.recommendation-toggle:focus-visible {
  outline: 2px solid #d97706;
  outline-offset: 2px;
}

.recommendation-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.missing-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px dashed #e5e7eb;
}

.missing-item-row:last-child {
  border-bottom: none;
}

.recommendation-row {
  align-items: flex-start;
}

.rec-text {
  flex: 1;
  color: #1f2937;
  line-height: 1.5;
}

.rec-text strong {
  color: #b45309;
}

.add-link-btn {
  border: 1px solid #3498db;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
}

.add-link-btn:hover {
  background: #dbeafe;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.recommendation-card {
  background: white;
  border: 2px solid #f39c12;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(243, 156, 18, 0.1);
}

.recommendation-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 8px 24px rgba(243, 156, 18, 0.2);
  border-color: #e67e22;
}

.recommendation-card .card-header {
  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.recommendation-card .card-header .icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.recommendation-card .card-header .ingredient-name {
  flex: 1;
  font-weight: 700;
  font-size: 1.05rem;
  margin: 0;
}

.recommendation-card .card-body {
  padding: 1rem;
  flex: 1;
}

.recommendation-card .card-body .benefit {
  margin: 0;
  font-size: 0.9rem;
  color: #7f8c8d;
  line-height: 1.6;
}

.recommendation-card .card-footer {
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-top: 1px solid #ecf0f1;
}

.recommendation-card .card-footer .note {
  margin: 0;
  font-size: 0.8rem;
  color: #95a5a6;
  font-style: italic;
}

.btn-add {
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(243, 156, 18, 0.4);
}

.btn-add:active {
  transform: translateY(0);
}

.recommendations-info {
  background: rgba(243, 156, 18, 0.1);
  border-left: 4px solid #f39c12;
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #5d4037;
  margin-top: 1rem;
}

.recommendations-info p {
  margin: 0;
  line-height: 1.6;
}

.recommendations-collapsed-note {
  margin-top: 0.7rem;
  padding: 0.7rem 0.85rem;
  border-radius: 8px;
  background: rgba(243, 156, 18, 0.08);
  border: 1px dashed #f59e0b;
  color: #92400e;
  font-size: 0.85rem;
}

.recommendations-collapsed-note p {
  margin: 0;
}

/* 排程主題選擇區塊 */
.themes-section {
  margin-bottom: 3rem;
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
  border: 3px solid #4caf50;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.15);
}

.themes-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #4caf50;
}

.themes-header h2 {
  color: #2e7d32;
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.themes-subtitle {
  color: #558b2f;
  font-size: 0.95rem;
  margin: 0;
  font-weight: 500;
}

.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.theme-checkbox {
  background: white;
  border: 2px solid #c8e6c9;
  border-radius: 10px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
}

.theme-checkbox:hover {
  border-color: #4caf50;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.1);
}

.theme-checkbox:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.theme-checkbox.selected {
  background: linear-gradient(135deg, #c8e6c9 0%, #dcedc8 100%);
  border-color: #4caf50;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.2);
}

.theme-icon {
  font-size: 1.75rem;
  flex-shrink: 0;
}

.theme-info {
  flex: 1;
}

.theme-label {
  font-weight: 700;
  color: #2e7d32;
  margin-bottom: 0.25rem;
}

.theme-desc {
  font-size: 0.85rem;
  color: #558b2f;
  line-height: 1.4;
}

.checkmark {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: #4caf50;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 700;
}

.custom-themes {
  background: white;
  border: 2px solid #c8e6c9;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.custom-themes label {
  display: block;
  color: #2e7d32;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.custom-input-group {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.custom-input-group input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #c8e6c9;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.custom-input-group input:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.btn-add-theme {
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-add-theme:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.custom-themes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.custom-theme-badge {
  background: linear-gradient(135deg, #a5d6a7 0%, #81c784 100%);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.btn-remove {
  background: rgba(255, 255, 255, 0.3);
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  padding: 0;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-remove:hover {
  background: rgba(255, 255, 255, 0.5);
}

.btn-save-themes {
  width: 100%;
  padding: 0.9rem 1.5rem;
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-save-themes:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(76, 175, 80, 0.3);
}

.btn-save-themes:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 主要排程區域 */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section h2 {
  color: #2c3e50;
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.routine-theme-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0.45rem 0 1rem;
}

.theme-tags-label {
  font-size: 0.85rem;
  color: #4b5563;
  font-weight: 700;
}

.theme-tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid #86efac;
  background: #ecfdf3;
  color: #166534;
  font-size: 0.8rem;
  font-weight: 700;
}

.theme-tag-empty {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 600;
}

.note {
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.filter-row label {
  margin: 0;
  font-size: 0.9rem;
  color: #34495e;
}

.category-filter-select {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.9rem;
}

/* 左側面板：產品庫存 */
.left-panel .product-list {
  min-height: 400px;
  background: #f8f9fa;
  border: 2px dashed #bdc3c7;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.product-item {
  background: white;
  border: 2px solid #3498db;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  color: #2c3e50;
  font-weight: 600;
  cursor: move;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
  user-select: none;
}

.product-item:hover {
  background: #ecf0f1;
  transform: translateX(2px);
}

.product-item.is-recommendation {
  border-color: #f39c12;
  background: #fffaed;
}

.product-item .badge {
  background: #f39c12;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.product-category-tag {
  background: #eef2ff;
  color: #4338ca;
  border-radius: 12px;
  padding: 0.2rem 0.5rem;
  font-size: 0.72rem;
  margin-left: auto;
  margin-right: 0.35rem;
}

.empty-inventory {
  padding: 2rem;
  text-align: center;
  color: #95a5a6;
  font-size: 0.95rem;
}

/* 右側面板：每日排程 */
.days-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.day-column {
  border: 2px solid #ecf0f1;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
}

.day-header {
  background: #34495e;
  color: white;
  padding: 0.75rem;
  text-align: center;
}

.day-header h3 {
  margin: 0;
  font-size: 1rem;
}

.time-slot {
  border-bottom: 1px solid #ecf0f1;
  padding: 0.75rem;
}

.time-slot:last-child {
  border-bottom: none;
}

.time-label {
  font-weight: 700;
  color: #2c3e50;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.drop-zone {
  min-height: 80px;
  background: white;
  border: 2px dashed #3498db;
  border-radius: 4px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: all 0.2s;
}

.drop-zone:hover {
  background: #f0f8ff;
  border-color: #2980b9;
}

.drop-zone.ghost {
  background: #e3f2fd;
  border-style: solid;
}

.scheduled-item {
  background: #ecf0f1;
  border-radius: 4px;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
  cursor: move;
  transition: all 0.2s;
}

.scheduled-item:hover {
  background: #bdc3c7;
}

.scheduled-item.is-recommendation {
  background: #fff3cd;
  border-left: 3px solid #f39c12;
}

.scheduled-item.is-locked {
  border-left: 3px solid #2563eb;
  background: #eaf2ff;
}

.btn-lock {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.95rem;
  padding: 0.1rem 0.25rem;
}

.btn-lock:hover {
  transform: scale(1.06);
}

.item-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.item-content .index {
  font-weight: 700;
  color: #7f8c8d;
  min-width: 20px;
}

.item-content .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #2c3e50;
}

.btn-remove {
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-weight: 700;
  transition: background 0.2s;
  min-width: 24px;
}

.btn-remove:hover {
  background: #c0392b;
}

.btn-remove:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

/* 底部操作 */
.footer {
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.btn-save,
.btn-reset {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
  font-size: 1rem;
}

.btn-save {
  background: #27ae60;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #229954;
  transform: translateY(-2px);
}

.btn-save:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-reset {
  background: #95a5a6;
  color: white;
}

.btn-reset:hover {
  background: #7f8c8d;
}

.save-message {
  margin-left: 1rem;
  font-weight: 600;
  color: #e74c3c;
}

.save-message.success {
  color: #27ae60;
}

/* 響應式設計 */
@media (max-width: 1024px) {
  .main-grid {
    grid-template-columns: 1fr;
  }

  .days-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
}

@media (max-width: 768px) {
  .schedule-container {
    padding: 1rem;
  }

  .header h1 {
    font-size: 1.75rem;
  }

  .section {
    padding: 1rem;
  }

  .footer {
    flex-direction: column;
  }

  .save-message {
    margin-left: 0;
    margin-top: 0.5rem;
  }

  .days-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .day-header h3 {
    font-size: 0.9rem;
  }

  .time-label {
    font-size: 0.75rem;
  }
}

/* 拖拽動畫 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.drag {
  opacity: 0.5;
}
</style>
