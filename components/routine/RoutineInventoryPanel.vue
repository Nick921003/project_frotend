<template>
  <div class="section left-panel">
    <h2>保養品庫存</h2>
    <p class="note">拖拽至右側，或點 ＋早 / ＋晚 加入目前選擇的日期</p>

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
        <div class="product-item-actions">
          <button class="btn-quick-add btn-quick-add--morning" @click.stop="quickAdd(product, 'morning')" title="加入早晨">＋早</button>
          <button class="btn-quick-add btn-quick-add--evening" @click.stop="quickAdd(product, 'evening')" title="加入晚間">＋晚</button>
        </div>
      </div>
      <div v-if="filteredAvailableProducts.length === 0" class="empty-inventory">
        <p>沒有可用的產品</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { CabinetProductItem } from '~/types/routine';
import { normalizeProductCategory } from '~/utils/productCategories';

const props = defineProps<{
  availableProducts: CabinetProductItem[];
  categoryOptions: readonly string[];
  onInventoryDragStart: (event: DragEvent, product: CabinetProductItem) => void;
  quickAdd: (product: CabinetProductItem, timeOfDay: 'morning' | 'evening') => void;
}>();

const selectedCategoryFilter = ref('ALL');

const normalizeCategory = (category?: string) => normalizeProductCategory(category);
const toDisplayCategory = (category?: string) => normalizeCategory(category);

const filteredAvailableProducts = computed(() => {
  if (selectedCategoryFilter.value === 'ALL') return props.availableProducts;
  return props.availableProducts.filter(
    p => normalizeCategory(p.product_category) === selectedCategoryFilter.value
  );
});
</script>

<style scoped>
.section { background: #fff; border: 1px solid var(--color-border-light); border-radius: 12px; padding: 20px; box-shadow: var(--shadow-sm); }
.section h2 { font-size: 18px; margin-bottom: 12px; }
.note { color: var(--color-text-muted); font-size: 13px; margin-bottom: 15px; }

.filter-row { margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
.filter-row label { font-size: 13px; color: var(--color-text-secondary); }
.category-filter-select { flex: 1; padding: 6px; border-radius: 6px; border: 1px solid #ddd; font-size: 13px; outline: none; }
.category-filter-select:focus { border-color: var(--color-accent); }

.product-list { min-height: 400px; display: flex; flex-direction: column; gap: 8px; }
.product-item { padding: 10px; border: 1px solid var(--color-accent); border-radius: 8px; display: flex; align-items: center; gap: 10px; cursor: grab; background: #fff; transition: background 0.15s; user-select: none; }
.product-item:hover { background: var(--color-accent-light); }

.product-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-category-tag { background: var(--color-gold-light); color: var(--color-gold); border-radius: 12px; padding: 2px 8px; font-size: 11px; flex-shrink: 0; }

.product-item.is-recommendation { border-color: var(--color-amber); background: var(--color-amber-light); }
.product-item .badge { background: var(--color-amber); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 11px; }

.product-item-actions { margin-left: auto; display: flex; gap: 4px; }
.btn-quick-add { padding: 2px 6px; font-size: 11px; border-radius: 4px; border: 1px solid var(--color-accent); background: none; color: var(--color-accent); cursor: pointer; transition: background 0.15s; }
.btn-quick-add--morning { border-color: #d97706; color: #d97706; }
.btn-quick-add--morning:hover { background: #fef3c7; }
.btn-quick-add--evening:hover { background: var(--color-accent-light); }

.empty-inventory { padding: 40px; text-align: center; color: var(--color-text-muted); font-size: 13px; }

@media (max-width: 768px) {
  .section { padding: var(--space-4); }
  .product-list { min-height: 200px; }
}
</style>
