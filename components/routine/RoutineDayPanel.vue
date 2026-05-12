<template>
  <div class="section right-panel">
    <h2>週排程</h2>

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

    <!-- 單日內容區 -->
    <div class="day-view">
      <!-- 早晨排程 -->
      <div class="time-slot morning">
        <div class="time-label">🌅 早晨</div>
        <div
          class="drop-zone"
          @dragover.prevent
          @drop="onProductDrop($event, expandedDayIdx, 'morning')"
        >
          <div v-if="getMorningItems(expandedDayIdx).length === 0" class="drop-hint">拖拽產品到這裡</div>
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
      </div>

      <!-- 晚間排程 -->
      <div class="time-slot evening">
        <div class="time-label">🌙 晚間</div>
        <div
          class="drop-zone"
          @dragover.prevent
          @drop="onProductDrop($event, expandedDayIdx, 'evening')"
        >
          <div v-if="getEveningItems(expandedDayIdx).length === 0" class="drop-hint">拖拽產品到這裡</div>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WeeklyRoutine, RoutineItem } from '~/types/routine';

const props = defineProps<{
  routine: WeeklyRoutine | null;
  daysOfWeek: string[];
  expandedDayIdx: number;
  selectedThemeTags: string[];
  onProductDragStart: Function;
  onProductDrop: Function;
}>();

defineEmits<{
  (e: 'update:expandedDayIdx', idx: number): void;
  (e: 'toggle-item-lock', item: RoutineItem): void;
  (e: 'remove-item', dayOfWeek: number, timeOfDay: 'morning' | 'evening', productName: string): void;
}>();

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
.section { background: #fff; border: 1px solid var(--color-border-light); border-radius: 12px; padding: 20px; box-shadow: var(--shadow-sm); }
.section h2 { font-size: 18px; margin-bottom: 12px; }

.day-tabs { display: flex; gap: 4px; margin-bottom: 15px; }
.day-tab { flex: 1; padding: 8px 0; border-radius: 20px; border: 1px solid #ddd; background: #f9f9f9; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 14px; transition: all 0.2s; }
.day-tab.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); box-shadow: 0 2px 8px rgba(180, 90, 60, 0.2); }
.tab-count { width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent); flex-shrink: 0; }
.day-tab.active .tab-count { background: #fff; }

.routine-theme-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; align-items: center; }
.theme-tags-label { font-size: 12px; color: var(--color-text-secondary); }
.theme-tag-chip { padding: 2px 8px; background: var(--color-sage-light); color: var(--color-sage); border-radius: 12px; font-size: 12px; font-weight: 600; }
.theme-tag-empty { font-size: 12px; color: var(--color-text-muted); }

.day-view { border: 1px solid #eee; border-radius: 8px; overflow: hidden; background: #fcfcfc; }
.time-slot { padding-bottom: 5px; }
.time-label { padding: 10px 15px; font-weight: 700; font-size: 14px; border-bottom: 1px solid #eee; }
.morning .time-label { background: #fffbeb; color: #92400e; }
.evening .time-label { background: #f5f3ff; color: #5b21b6; }

.drop-zone { min-height: 80px; margin: 10px; border: 2px dashed #e5e7eb; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s; }
.drop-zone:hover { background: #f3f4f6; border-color: var(--color-accent); }
.drop-hint { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; font-style: italic; }

.scheduled-item { padding: 10px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; transition: transform 0.1s; }
.scheduled-item:hover { transform: translateX(2px); border-color: #cbd5e1; }
.scheduled-item.is-recommendation { border-left: 3px solid var(--color-amber); background: var(--color-amber-light); }
.scheduled-item.is-locked { border-left: 3px solid var(--color-gold); background: var(--color-gold-light); }

.item-content { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.index { font-weight: 700; color: #94a3b8; font-size: 11px; width: 15px; }
.name { color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.btn-lock { background: none; border: none; cursor: pointer; padding: 2px; font-size: 14px; opacity: 0.7; transition: opacity 0.2s; }
.btn-lock:hover { opacity: 1; }
.btn-remove { background: #fee2e2; color: #ef4444; border: none; border-radius: 4px; cursor: pointer; padding: 2px 8px; font-weight: 700; font-size: 14px; transition: background 0.2s; }
.btn-remove:hover { background: #fecaca; }
</style>
