<template>
  <div class="schedule-page">
    <!-- 標題與主題設定區 (Component A) -->
    <RoutineHeader
      :routine="routine"
      :routine-id="routineId"
      :can-edit="canEdit"
      @meta-saved="(name, desc) => { if (routine) { routine.name = name; routine.description = desc; } }"
      @themes-saved="(themes, custom) => { if (routine) { routine.themes = themes; routine.custom_themes = custom; } }"
      @message="handleMessage"
    />

    <!-- 分享按鈕（僅擁有者） -->
    <div v-if="isOwner" class="mb-3 flex justify-end">
      <button
        class="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-accent hover:bg-gray-50"
        @click="showShareModal = true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
        </svg>
        分享
      </button>
    </div>
    <ShareRoutineModal v-if="showShareModal" :routine-id="routineId" @close="showShareModal = false" />

    <!-- 載入與錯誤狀態 -->
    <div v-if="pageLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在載入排程...</p>
    </div>
    <div v-if="pageError" class="error-banner">
      {{ pageError }}
    </div>

    <div v-if="!pageLoading && routine" class="content">
    <!-- AI 推薦與順序建議 (Component D) -->
      <RoutineRecommendations
        :efficacy-recs="efficacyRecs"
        :recs-loading="recsLoading"
        :usage-order-tips="usageOrderTips"
        :routine-id="routineId"
        @go-add-product="goToAddProduct"
        @go-to-ai-recs="goToAIRecs"
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
          :product-analysis-map="productAnalysisMap"
          :conflicts-by-day="routine.conflicts_by_day || {}"
          :checked-item-ids="checkedItemIds"
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
import ShareRoutineModal from '~/components/routine/ShareRoutineModal.vue';

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
const showShareModal = ref(false);
const canEdit = computed(() => (routine.value as any)?._access?.permission !== 'view');
const isOwner = computed(() => (routine.value as any)?._access?.role === 'owner');

const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
const expandedDayIdx = ref(new Date().getDay());
const availableProducts = ref<CabinetProductItem[]>([]);
const categoryOptions = PRODUCT_CATEGORIES;

// ==================
// 計算屬性
// ==================
const {
  efficacyRecs,
  recsLoading,
  usageOrderTips,
} = useRoutineRecommendations(routine, availableProducts, routineId)

// productId → { regulatoryAlerts, skinTypeAlerts } 的快查表
const productAnalysisMap = computed(() => {
  const map = new Map<string, any>();
  for (const p of (routine.value?.all_products || [])) {
    if (p.id && (p as any).analysis_result?.analysis) {
      map.set(p.id, (p as any).analysis_result.analysis);
    }
  }
  return map;
});

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

const removeItem = (item: RoutineItem) => {
  if (!routine.value) return;
  // 鎖定項目不可刪除（雙重保險）
  if (item.is_locked) {
    handleMessage(false, '🔒 此項目已鎖定，請先解鎖');
    return;
  }
  // 用精確的物件參照或 id 定位
  const idx = item.id
    ? routine.value.items.findIndex(i => i.id === item.id)
    : routine.value.items.findIndex(i =>
        i.day_of_week === item.day_of_week &&
        i.time_of_day === item.time_of_day &&
        i.product_name === item.product_name
      );
  if (idx >= 0 && routine.value) {
    const target = routine.value.items[idx];
    routine.value.items.splice(idx, 1);
    // 重新排序
    getItemsForTimeslot(target.day_of_week, target.time_of_day).forEach((it, i) => { it.sequence_order = i; });
  }
};

const toggleItemLock = async (item: RoutineItem) => {
  if (!item.id) {
    handleMessage(false, '❌ 請先保存排序再鎖定項目');
    return;
  }
  if (!canEdit.value) return;
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
  if (!canEdit.value) return;
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
// 每日打卡
// ==================
const today = new Date().toISOString().slice(0, 10);
const checkedItemIds = ref(new Set<string>());

const loadCheckins = async () => {
  if (!routineId) return;
  try {
    const res = await $fetch<{ success: boolean; data: { checked_ids: string[] } }>(
      `/api/routines/${routineId}/checkins`,
      { query: { date: today } }
    );
    checkedItemIds.value = new Set(res.data?.checked_ids ?? []);
  } catch {
    // 非致命，打卡狀態載入失敗不阻斷頁面
  }
};

const handleToggleCheckin = async (itemId: string) => {
  try {
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
  } catch {
    // 打卡操作失敗不阻斷頁面
  }
};

// ==================
// 導覽方法
// ==================
const goToAIRecs = () => router.push({ path: '/routines/new', query: { action: 'recs', routineId } });
const goToAddProduct = (cat: string) => router.push({ path: '/', query: { from: 'routine', routineId, category: cat } });
// ==================
// 生命週期
// ==================
onMounted(async () => {
  pageLoading.value = true;
  await loadRoutineById();

  // 從 sessionStorage 讀取上次 AI 推薦結果
  const stored = sessionStorage.getItem(`efficacyRecs_${routineId}`)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) efficacyRecs.value = parsed
    } catch {}
    sessionStorage.removeItem(`efficacyRecs_${routineId}`)
  }

  await loadCheckins();
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
  gap: var(--space-3);
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

.mode-btn.ai-recs {
  background: var(--color-sage);
}

.mode-btn.ai-recs:hover:not(:disabled) { background: #7a9c8f; }

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

.btn-primary { padding: 8px 16px; background: var(--color-accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.btn-secondary { padding: 8px 16px; background: var(--color-surface); color: var(--color-accent); border: 1px solid var(--color-accent); border-radius: 6px; cursor: pointer; }

.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
  .main-grid > * {
    max-height: 70vh;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}

@media (max-width: 768px) {
  .schedule-page { padding: var(--space-4) var(--space-3); }
  .footer { flex-direction: column; text-align: center; }
}
</style>
