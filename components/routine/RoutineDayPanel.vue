<template>
  <div class="section right-panel">
    <!-- 日期標籤列 -->
    <div class="day-tabs">
      <button
        v-for="(dayName, dayIdx) in daysOfWeek"
        :key="dayIdx"
        class="day-tab"
        :class="{ 'active': dayIdx === expandedDayIdx }"
        @click="$emit('update:expandedDayIdx', dayIdx)"
      >
        {{ dayName }}
        <span
          v-if="getMorningItems(dayIdx).length + getEveningItems(dayIdx).length > 0"
          class="tab-count"
        ></span>
        <span
          v-if="conflictsByDay[dayIdx]?.length"
          class="tab-conflict"
          :title="conflictsByDay[dayIdx].map(c => c.message).join('\n')"
        >⚠</span>
      </button>
    </div>

    <!-- 主題標籤 -->
    <div class="routine-theme-tags">
      <span class="theme-tags-label">主題：</span>
      <template v-if="selectedThemeTags.length > 0">
        <span
          v-for="(theme, idx) in selectedThemeTags"
          :key="idx"
          class="theme-tag-chip"
        >#{{ theme }}</span>
      </template>
      <span v-else class="theme-tag-empty">—</span>
    </div>

    <!-- 成分衝突警示 -->
    <div v-if="conflictWarnings && conflictWarnings.length > 0" class="conflict-warnings">
      <div
        v-for="(warn, i) in conflictWarnings"
        :key="i"
        class="conflict-item"
      >
        <span class="conflict-label">⚠ 成分衝突</span>
        {{ warn.ingredientA }} × {{ warn.ingredientB }}（{{ warn.products[0] }} 與 {{ warn.products[1] }}）：{{ warn.reason }}
      </div>
    </div>

    <!-- 單日內容區 -->
    <div class="day-view">
      <!-- 成分衝突提示 -->
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

      <!-- 早晨排程 -->
      <div class="time-slot morning">
        <div class="time-label">早晨</div>
        <div
          class="drop-zone"
          @dragover.prevent
          @drop="onProductDrop($event, expandedDayIdx, 'morning')"
        >
          <div v-if="getMorningItems(expandedDayIdx).length === 0" class="drop-hint">拖拽產品到這裡</div>
          <div
            v-for="(item, idx) in getMorningItems(expandedDayIdx)"
            :key="itemKey(item, idx)"
            class="scheduled-item"
            :class="{ 'is-recommendation': item.is_recommendation, 'is-locked': item.is_locked }"
            :draggable="!item.is_locked"
            @dragstart="onProductDragStart($event, item, expandedDayIdx, 'morning')"
          >
            <div class="item-main">
              <div class="item-content">
                <span class="index">{{ idx + 1 }}</span>
                <span class="name">{{ item.product_name }}</span>
                <span v-if="item.is_orphan" class="badge-orphan">產品已刪除</span>
                <button
                  v-if="item.notes"
                  class="btn-notes"
                  :class="{ 'active': expandedNotes.has(itemKey(item, idx)) }"
                  @click.stop="toggleNotes(itemKey(item, idx))"
                  title="查看步驟說明"
                >說明</button>
              </div>
              <div class="item-actions">
                <button
                  @click="$emit('toggle-item-lock', item)"
                  class="btn-lock"
                  :title="item.is_locked ? '解鎖' : '鎖定'"
                >{{ item.is_locked ? '🔒' : '🔓' }}</button>
                <button
                  @click="$emit('remove-item', expandedDayIdx, 'morning', item.product_name)"
                  class="btn-remove"
                >×</button>
              </div>
            </div>
            <div v-if="item.notes && expandedNotes.has(itemKey(item, idx))" class="item-notes">
              {{ item.notes }}
            </div>
            <details
              v-if="item.product_id && productAnalysisMap.get(item.product_id)"
              class="item-analysis"
            >
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
          </div>
        </div>
      </div>

      <!-- 晚間排程 -->
      <div class="time-slot evening">
        <div class="time-label">晚間</div>
        <div
          class="drop-zone"
          @dragover.prevent
          @drop="onProductDrop($event, expandedDayIdx, 'evening')"
        >
          <div v-if="getEveningItems(expandedDayIdx).length === 0" class="drop-hint">拖拽產品到這裡</div>
          <div
            v-for="(item, idx) in getEveningItems(expandedDayIdx)"
            :key="itemKey(item, idx)"
            class="scheduled-item"
            :class="{ 'is-recommendation': item.is_recommendation, 'is-locked': item.is_locked }"
            :draggable="!item.is_locked"
            @dragstart="onProductDragStart($event, item, expandedDayIdx, 'evening')"
          >
            <div class="item-main">
              <div class="item-content">
                <span class="index">{{ idx + 1 }}</span>
                <span class="name">{{ item.product_name }}</span>
                <span v-if="item.is_orphan" class="badge-orphan">產品已刪除</span>
                <button
                  v-if="item.notes"
                  class="btn-notes"
                  :class="{ 'active': expandedNotes.has(itemKey(item, idx)) }"
                  @click.stop="toggleNotes(itemKey(item, idx))"
                  title="查看步驟說明"
                >說明</button>
              </div>
              <div class="item-actions">
                <button
                  @click="$emit('toggle-item-lock', item)"
                  class="btn-lock"
                  :title="item.is_locked ? '解鎖' : '鎖定'"
                >{{ item.is_locked ? '🔒' : '🔓' }}</button>
                <button
                  @click="$emit('remove-item', expandedDayIdx, 'evening', item.product_name)"
                  class="btn-remove"
                >×</button>
              </div>
            </div>
            <div v-if="item.notes && expandedNotes.has(itemKey(item, idx))" class="item-notes">
              {{ item.notes }}
            </div>
            <details
              v-if="item.product_id && productAnalysisMap.get(item.product_id)"
              class="item-analysis"
            >
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { WeeklyRoutine, RoutineItem } from '~/types/routine';
import type { ConflictWarning } from '~/utils/ingredientConflicts';

const props = withDefaults(defineProps<{
  routine: WeeklyRoutine | null;
  daysOfWeek: string[];
  expandedDayIdx: number;
  selectedThemeTags: string[];
  conflictWarnings?: ConflictWarning[];
  onProductDragStart: Function;
  onProductDrop: Function;
  productAnalysisMap?: Map<string, any>;
  conflictsByDay?: Record<number, { rule: string; message: string }[]>;
}>(), {
  productAnalysisMap: () => new Map(),
  conflictsByDay: () => ({})
});

defineEmits<{
  (e: 'update:expandedDayIdx', idx: number): void;
  (e: 'toggle-item-lock', item: RoutineItem): void;
  (e: 'remove-item', dayOfWeek: number, timeOfDay: 'morning' | 'evening', productName: string): void;
}>();

/** 記錄哪些 item 展開了 notes */
const expandedNotes = ref<Set<string>>(new Set());

function toggleNotes(key: string) {
  if (expandedNotes.value.has(key)) {
    expandedNotes.value.delete(key);
  } else {
    expandedNotes.value.add(key);
  }
  // 觸發響應
  expandedNotes.value = new Set(expandedNotes.value);
}

function itemKey(item: RoutineItem, idx: number): string {
  return item.id ?? `${item.day_of_week}-${item.time_of_day}-${idx}`;
}

const getItemsForTimeslot = (dayOfWeek: number, timeOfDay: 'morning' | 'evening'): RoutineItem[] => {
  if (!props.routine) return [];
  return props.routine.items.filter(
    item => item.day_of_week === dayOfWeek && item.time_of_day === timeOfDay
  );
};

const getMorningItems = (dayIdx: number) =>
  getItemsForTimeslot(dayIdx, 'morning').sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));

const getEveningItems = (dayIdx: number) =>
  getItemsForTimeslot(dayIdx, 'evening').sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
</script>

<style scoped>
.section { background: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); padding: var(--space-5); box-shadow: var(--shadow-sm); }
.section h2 { font-size: 17px; margin-bottom: var(--space-3); font-family: var(--font-heading); color: var(--color-text-primary); }

.day-tabs { display: flex; gap: 4px; margin-bottom: 15px; }
.day-tab { flex: 1; padding: 8px 0; border-radius: var(--radius-pill); border: 1px solid var(--color-border); background: var(--color-surface-alt); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 14px; transition: all 0.2s; color: var(--color-text-secondary); }
.day-tab.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); box-shadow: var(--shadow-sm); }
.tab-count { width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); flex-shrink: 0; }
.day-tab.active .tab-count { background: #fff; }

.routine-theme-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; align-items: center; }
.theme-tags-label { font-size: 12px; color: var(--color-text-secondary); }
.theme-tag-chip { padding: 2px 8px; background: var(--color-sage-light); color: var(--color-sage); border-radius: var(--radius-pill); font-size: 12px; font-weight: 600; }
.theme-tag-empty { font-size: 12px; color: var(--color-text-muted); }

.day-view { border: 1px solid var(--color-border-light); border-radius: var(--radius-md); overflow: hidden; background: var(--color-bg); }
.time-slot { padding-bottom: 5px; }
.time-label { padding: 10px 15px; font-weight: 600; font-size: 13px; letter-spacing: 0.05em; border-bottom: 1px solid var(--color-border-light); color: var(--color-text-secondary); font-family: var(--font-body); }
.morning .time-label { background: var(--color-amber-light); color: #7A5A30; }
.evening .time-label { background: var(--color-sage-light); color: #3A5A45; }

.drop-zone { min-height: 80px; margin: 10px; border: 1px dashed var(--color-border); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s; }
.drop-zone:hover { background: var(--color-surface-alt); border-color: var(--color-accent); }
.drop-hint { text-align: center; color: var(--color-text-muted); font-size: 12px; margin-top: 20px; }

.scheduled-item { padding: 10px; background: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: var(--radius-md); display: flex; flex-direction: column; font-size: 13px; transition: border-color 0.15s; }
.scheduled-item:hover { border-color: var(--color-warm-dark); }
.scheduled-item.is-recommendation { border-left: 3px solid var(--color-amber); background: var(--color-amber-light); }
.scheduled-item.is-locked { border-left: 3px solid var(--color-gold); background: var(--color-gold-light); }

/* 衝突警示 */
.conflict-warnings { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
.conflict-item { font-size: 12px; color: #b45309; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 8px 12px; line-height: 1.5; }
.conflict-label { font-weight: 700; margin-right: 4px; }

/* item 佈局 */
.item-main { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.item-content { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.item-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.index { font-weight: 700; color: #94a3b8; font-size: 11px; width: 15px; }
.name { color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* notes 展開 */
.btn-notes { background: none; border: 1px solid var(--color-border); color: var(--color-text-secondary); border-radius: 4px; cursor: pointer; padding: 1px 6px; font-size: 11px; transition: all 0.15s; flex-shrink: 0; }
.btn-notes:hover, .btn-notes.active { background: var(--color-accent-light); border-color: var(--color-accent); color: var(--color-accent); }
.item-notes { margin-top: 6px; padding: 6px 10px; background: var(--color-surface-alt); border-left: 2px solid var(--color-accent); border-radius: 0 4px 4px 0; font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; }

.btn-lock { background: none; border: none; cursor: pointer; padding: 2px; font-size: 14px; opacity: 0.7; transition: opacity 0.2s; }
.btn-lock:hover { opacity: 1; }
.btn-remove { background: var(--color-red-light); color: var(--color-red); border: none; border-radius: var(--radius-sm); cursor: pointer; padding: 2px 8px; font-weight: 700; font-size: 14px; transition: background 0.2s; }
.btn-remove:hover { background: #F0D0D0; }

.tab-conflict { font-size: 11px; color: var(--color-amber); margin-left: 2px; }
.conflict-banner {
	background: #FFF8EE;
	border: 1px solid var(--color-amber);
	border-radius: var(--radius-md);
	padding: var(--space-sm, 8px) var(--space-md, 12px);
	margin-bottom: var(--space-md, 12px);
	font-size: 13px;
	color: var(--color-text-primary);
}
.conflict-banner ul { margin: 4px 0 0; padding-left: 16px; }

.item-analysis { flex: 0 0 100%; margin-top: var(--space-xs, 4px); }
.item-analysis__toggle { font-size: 11px; color: var(--color-text-muted); cursor: pointer; }
.item-analysis__body { font-size: 12px; padding: var(--space-xs, 4px) 0; }
.alert-label { font-size: 11px; font-weight: 600; margin: 4px 0 2px; }
.alert-label--red { color: var(--color-critical); }
.alert-label--yellow { color: var(--color-amber); }
.item-analysis ul { margin: 0; padding-left: 16px; }

.badge-orphan {
	font-size: 11px;
	color: var(--color-critical);
	border: 1px solid var(--color-critical);
	border-radius: var(--radius-sm);
	padding: 1px 6px;
	margin-left: var(--space-sm);
	flex-shrink: 0;
}

@media (max-width: 768px) {
  .section { padding: var(--space-4); }
  .day-tab { font-size: 13px; padding: 6px 0; }
}
</style>
