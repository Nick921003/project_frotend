<template>
  <div class="schedule-page">
    <!-- 標題與主題設定區 (Component A) -->
    <RoutineHeader
      :routine="routine"
      :routine-id="routineId"
      @meta-saved="(name, desc) => { if (routine) { routine.name = name; routine.description = desc; } }"
      @themes-saved="(themes, custom) => { if (routine) { routine.themes = themes; routine.custom_themes = custom; } }"
      @message="handleMessage"
    />

    <!-- AI 重新排成按鈕 -->
    <div class="mode-toggle">
      <button
        @click="goToAIPreferences"
        class="mode-btn ai-regenerate"
        :disabled="savingOrder"
      >
        AI 重新排成
      </button>
    </div>

    <!-- 載入與錯誤狀態 -->
    <div v-if="pageLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在載入排程...</p>
    </div>
    <div v-if="pageError" class="error-banner">
      {{ pageError }}
    </div>

    <div v-if="!pageLoading && routine" class="content">
      <!-- 空排程提示 (高優先級) -->
      <div v-if="routine.items.length === 0 && !routine.created_by_ai" class="empty-routine-alert">
        <div class="alert-content">
          <h2>排程還是空的</h2>
          <p class="alert-message">
            {{ routine._empty_reason === 'no_products' ? '您目前還沒有添加任何保養品。請先前往保養品櫃添加一些產品。' : '您可以從左側庫存拖拽產品到日程表。' }}
          </p>
          <div class="alert-actions">
            <button @click="goToCabinet" class="btn-primary">前往保養品櫃</button>
            <button @click="goBack" class="btn-secondary">返回上一頁</button>
          </div>
        </div>
      </div>

      <!-- AI 推薦與順序建議 (Component D) -->
      <RoutineRecommendations
        :unified-recommendations="unifiedRecommendations"
        :is-products-sufficient="isProductsSufficient"
        :usage-order-tips="usageOrderTips"
        :routine-id="routineId"
        @go-add-product="goToAddProduct"
      />

      <!-- 主要排程區域 -->
      <div class="main-grid">
        <!-- 左側：保養品庫存 (Component B) -->
        <RoutineInventoryPanel
          :available-products="availableProducts"
          :category-options="categoryOptions"
          :on-inventory-drag-start="onInventoryDragStart"
          :quick-add="quickAdd"
        />

        <!-- 右側：每日週排程 (Component C) -->
        <RoutineDayPanel
          v-model:expanded-day-idx="expandedDayIdx"
          :routine="routine"
          :days-of-week="daysOfWeek"
          :selected-theme-tags="selectedThemeTags"
          :conflict-warnings="conflictWarnings"
          :on-product-drag-start="onProductDragStart"
          :on-product-drop="onProductDrop"
          @toggle-item-lock="toggleItemLock"
          @remove-item="removeItem"
        />
      </div>

      <!-- 底部操作列 -->
      <div class="footer">
        <button @click="saveChanges" class="btn-save" :disabled="savingOrder">
          {{ savingOrder ? '保存中...' : '保存排序' }}
        </button>
        <button @click="resetSchedule" class="btn-reset">重設</button>
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
import { useRoutineRecommendations } from '~/composables/useRoutineRecommendations';
import { useRoutineDragDrop } from '~/composables/useRoutineDragDrop';
import { AVAILABLE_ROUTINE_THEMES } from '~/types/routine';
import type { RoutineItem, CabinetProductItem } from '~/types/routine';
import { PRODUCT_CATEGORIES } from '~/utils/productCategories';

// ==================
// 基礎狀態與路由
// ==================
const { routine } = useCreateRoutine();
const route = useRoute();
const router = useRouter();
const routineId = route.params.id as string;

const pageLoading = ref(true);
const pageError = ref<string | null>(null);
const savingOrder = ref(false);
const saveMessage = ref<string | null>(null);
const saveSuccess = ref(false);

const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
const expandedDayIdx = ref(new Date().getDay());
const availableProducts = ref<CabinetProductItem[]>([]);
const categoryOptions = PRODUCT_CATEGORIES;

// ==================
// 計算屬性
// ==================
const {
  unifiedRecommendations,
  isProductsSufficient,
  usageOrderTips,
  loadTempRecommendations,
} = useRoutineRecommendations(routine, availableProducts, PRODUCT_CATEGORIES, routineId);

const selectedThemeTags = computed(() => {
  if (!routine.value) return [];
  const predefined = (routine.value.themes || [])
    .map(id => AVAILABLE_ROUTINE_THEMES.find(t => t.id === id)?.label || id);
  return Array.from(new Set([...predefined, ...(routine.value.custom_themes || [])])).filter(Boolean);
});

// ==================
// DND 輔助邏輯
// ==================
const getItemsForTimeslot = (dayOfWeek: number, timeOfDay: 'morning' | 'evening'): RoutineItem[] => {
  if (!routine.value) return [];
  return routine.value.items.filter(item => item.day_of_week === dayOfWeek && item.time_of_day === timeOfDay);
};

const { onInventoryDragStart, onProductDragStart, onProductDrop, quickAdd, conflictWarnings } = useRoutineDragDrop(
  routine, expandedDayIdx, daysOfWeek, saveMessage, saveSuccess, getItemsForTimeslot
);

// ==================
// 核心 API 方法
// ==================
const loadRoutineById = async () => {
  try {
    const res = await $fetch<any>(`/api/routines/${routineId}`);
    if (res.success) {
      routine.value = res.data;
      availableProducts.value = Array.isArray(res.data.all_products) ? res.data.all_products : [];
    } else {
      throw new Error(res.message);
    }
  } catch (err: any) {
    pageError.value = '無法載入排程';
  }
};

const handleMessage = (success: boolean, text: string) => {
  saveSuccess.value = success;
  saveMessage.value = text;
  if (success) setTimeout(() => { saveMessage.value = null; }, 3000);
};

const removeItem = (dayOfWeek: number, timeOfDay: 'morning' | 'evening', productName: string) => {
  if (!routine.value) return;
  const idx = routine.value.items.findIndex(i =>
    i.day_of_week === dayOfWeek && i.time_of_day === timeOfDay && i.product_name === productName
  );
  if (idx >= 0 && routine.value) {
    const item = routine.value.items[idx];
    if (item?.is_locked) {
      handleMessage(false, '🔒 此項目已鎖定，請先解鎖');
      return;
    }
    routine.value.items.splice(idx, 1);
    // 重新排序
    getItemsForTimeslot(dayOfWeek, timeOfDay).forEach((item, i) => { item.sequence_order = i; });
  }
};

const toggleItemLock = async (item: RoutineItem) => {
  if (!item.id) {
    handleMessage(false, '❌ 請先保存排序再鎖定項目');
    return;
  }
  try {
    const next = !item.is_locked;
    const res = await $fetch<any>(`/api/routines/items/${item.id}/lock`, {
      method: 'PATCH',
      body: { is_locked: next }
    });
    if (res.success) {
      item.is_locked = next;
      handleMessage(true, next ? '🔒 項目已鎖定' : '🔓 項目已解鎖');
    }
  } catch (err: any) {
    handleMessage(false, '❌ 鎖定狀態更新失敗');
  }
};

const saveChanges = async () => {
  if (!routine.value) return;
  savingOrder.value = true;
  saveMessage.value = '正在儲存...';
  try {
    const updates = routine.value.items.map(item => ({
      ...item,
      sequence_order: item.sequence_order ?? 0
    }));
    const res = await $fetch<any>('/api/routines/update-order', {
      method: 'POST',
      body: { routine_id: routineId, updates }
    });
    if (res.success) {
      handleMessage(true, '✅ 已成功保存排序更改');
    }
  } catch (err: any) {
    handleMessage(false, '❌ 保存排序失敗');
  } finally {
    savingOrder.value = false;
  }
};

const resetSchedule = async () => {
  if (confirm('確定要捨棄未保存的更改並重設嗎？')) {
    pageLoading.value = true;
    await loadRoutineById();
    pageLoading.value = false;
    handleMessage(true, '✅ 已重設為最新保存版本');
  }
};

// ==================
// 導覽方法
// ==================
const goToAIPreferences = () => router.push({ path: '/routines/new', query: { action: 'regenerate', routineId } });
const goToAddProduct = (cat: string) => router.push({ path: '/', query: { from: 'routine', routineId, category: cat } });
const goToCabinet = () => router.push({ path: '/', query: { from: 'routine', routineId, source: 'empty-routine' } });
const goBack = () => router.back();

// ==================
// 生命週期
// ==================
onMounted(async () => {
  pageLoading.value = true;
  if (route.query.regenResult === 'recommended') loadTempRecommendations();
  await loadRoutineById();
  pageLoading.value = false;
});
</script>

<style scoped>
.schedule-page {
  min-height: 100vh;
  padding: var(--space-6) var(--space-5);
  max-width: 1200px;
  margin: 0 auto;
}

.mode-toggle {
  margin-bottom: var(--space-6);
  display: flex;
  justify-content: center;
}

.mode-btn {
  padding: 10px 24px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  border: none;
  background: var(--color-accent);
  color: #fff;
  transition: background 0.2s;
}

.mode-btn:hover:not(:disabled) { background: var(--color-accent-hover); }
.mode-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  color: #fff;
}

.spinner {
  width: 44px; height: 44px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-banner {
  padding: var(--space-3) var(--space-4);
  background: var(--color-red-light);
  border: 1px solid #E8C0C0;
  border-radius: 8px;
  color: var(--color-red);
  margin-bottom: var(--space-5);
}

.empty-routine-alert {
  background: var(--color-accent-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-8);
  margin-bottom: var(--space-6);
}

.alert-content h2 { margin: 0 0 var(--space-2); font-size: 18px; font-family: var(--font-heading); }
.alert-message { color: var(--color-text-secondary); margin-bottom: 16px; }
.alert-actions { display: flex; gap: 12px; }

.btn-primary { padding: 8px 16px; background: var(--color-accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.btn-secondary { padding: 8px 16px; background: var(--color-surface); color: var(--color-accent); border: 1px solid var(--color-accent); border-radius: 6px; cursor: pointer; }

.main-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
  align-items: start;
}

.footer {
  padding: var(--space-5) var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
  box-shadow: var(--shadow-sm);
}

.btn-save {
  padding: 10px 32px;
  background: var(--color-sage);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-save:hover:not(:disabled) { background: #7A9870; }
.btn-save:disabled { background: var(--color-text-muted); cursor: not-allowed; }

.btn-reset {
  padding: 10px 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.save-message { font-size: 14px; font-weight: 600; color: var(--color-red); }
.save-message.success { color: var(--color-sage); }

@media (max-width: 1024px) {
  .main-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .schedule-page { padding: var(--space-4) var(--space-3); }
  .footer { flex-direction: column; text-align: center; }
}
</style>
