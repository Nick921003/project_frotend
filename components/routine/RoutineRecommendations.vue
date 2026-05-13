<template>
  <div class="recommendations-container">
    <!-- AI 功效推薦區 -->
    <div class="recs-section">
      <div class="recs-header">
        <div class="recs-header-left">
          <h2>AI 功效推薦</h2>
          <p class="recs-subtitle">根據您的膚況與現有成分缺口，建議補充以下產品</p>
        </div>
        <!-- AI 推薦按鈕：永遠顯示 -->
        <button class="ai-recs-btn" @click="$emit('go-to-ai-recs')" :disabled="recsLoading">
          ✨ {{ recsLoading ? '分析中...' : efficacyRecs.length > 0 ? '重新分析' : 'AI 推薦' }}
        </button>
      </div>

      <div v-if="recsLoading" class="recs-loading">
        <div class="mini-spinner"></div>
        <span>AI 分析中，請稍候...</span>
      </div>

      <div v-else-if="efficacyRecs.length === 0" class="recs-empty">
        點擊「AI 推薦」，根據困擾生成補充建議
      </div>

      <!-- 推薦卡列表 -->
      <div v-else class="recs-list">
        <div
          v-for="rec in efficacyRecs"
          :key="`${rec.issue}-${rec.category}`"
          class="rec-card"
        >
          <div class="rec-card-top">
            <div class="rec-meta">
              <span class="rec-issue-badge">{{ rec.issue }}</span>
              <span class="rec-category-label">建議補充：<strong>{{ rec.category }}</strong></span>
            </div>
            <!-- 每張卡個別「去新增」按鈕 -->
            <button class="add-product-btn" @click="$emit('go-add-product', rec.category)">
              + 去新增
            </button>
          </div>
          <p class="rec-reason">{{ rec.reason }}</p>
          <div class="rec-ingredients">
            <span v-for="ing in rec.suggestedIngredients" :key="ing" class="ing-chip">{{ ing }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 建議使用順序 — 可折疊 + 品類篩選 -->
    <div class="usage-tips-section">
      <button class="usage-tips-toggle" @click="usageOpen = !usageOpen">
        <span>📋 建議使用順序</span>
        <span class="toggle-chevron" :class="{ open: usageOpen }">▾</span>
      </button>

      <div v-show="usageOpen" class="usage-tips-body">
        <!-- 品類篩選 -->
        <div class="usage-filter">
          <span class="filter-label">顯示品類：</span>
          <label
            v-for="tip in usageOrderTips"
            :key="tip.category"
            class="filter-pill"
            :class="{ active: selectedCategories.includes(tip.category) }"
          >
            <input type="checkbox" :value="tip.category" v-model="selectedCategories" />
            {{ tip.category }}
          </label>
          <button v-if="selectedCategories.length > 0" class="clear-filter" @click="selectedCategories = []">全部</button>
        </div>

        <!-- 步驟卡片 -->
        <div class="usage-steps">
          <div
            v-for="tip in filteredTips"
            :key="tip.category"
            class="usage-step"
          >
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { EfficacyRecommendation } from '~/composables/useRoutineRecommendations'
import { USAGE_ORDER_TIPS } from '~/composables/useRoutineRecommendations'

const props = defineProps<{
  efficacyRecs: EfficacyRecommendation[]
  recsLoading: boolean
  usageOrderTips: typeof USAGE_ORDER_TIPS
  routineId: string
}>()

defineEmits<{
  (e: 'go-add-product', category: string): void
  (e: 'go-to-ai-recs'): void
}>()

// 使用順序折疊狀態
const usageOpen = ref(true)

// 品類篩選（空 = 全選）
const selectedCategories = ref<string[]>([])

const filteredTips = computed(() =>
  selectedCategories.value.length === 0
    ? props.usageOrderTips
    : props.usageOrderTips.filter(t => selectedCategories.value.includes(t.category))
)
</script>

<style scoped>
.recommendations-container {
  margin-bottom: var(--space-6);
}

/* ── AI 推薦區 ── */
.recs-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-4);
}

.recs-header {
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface-alt);
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.recs-header-left h2 {
  font-size: 16px;
  color: var(--color-text-primary);
  margin: 0 0 4px 0;
  font-family: var(--font-heading);
}

.recs-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.ai-recs-btn {
  flex-shrink: 0;
  background: var(--color-accent);
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-body);
  white-space: nowrap;
  transition: opacity 0.15s;
}
.ai-recs-btn:hover:not(:disabled) { opacity: 0.88; }
.ai-recs-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.recs-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: var(--space-5);
  justify-content: center;
}

.mini-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.recs-empty {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: var(--space-5);
  text-align: center;
}

.recs-list {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.rec-card {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  background: var(--color-surface);
}

.rec-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.rec-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.rec-issue-badge {
  background: var(--color-warm);
  color: var(--color-accent);
  border: 1px solid var(--color-warm-dark);
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 99px;
}

.rec-category-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.rec-category-label strong {
  color: var(--color-text-primary);
}

.add-product-btn {
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--color-sage);
  color: var(--color-sage);
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--font-body);
  transition: background 0.15s;
}
.add-product-btn:hover { background: var(--color-sage-light, #EAF0EC); }

.rec-reason {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-2) 0;
  line-height: 1.55;
}

.rec-ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ing-chip {
  display: inline-block;
  background: var(--color-surface-alt);
  border-radius: 99px;
  padding: 2px 9px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* ── 使用順序區 ── */
.usage-tips-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-4);
}

.usage-tips-toggle {
  width: 100%;
  background: var(--color-surface-alt);
  border: none;
  border-bottom: 1px solid transparent;
  padding: var(--space-4) var(--space-5);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: var(--font-heading);
}

.usage-tips-toggle:hover { background: var(--color-warm); }

.toggle-chevron {
  font-size: 16px;
  transition: transform 0.2s;
  display: inline-block;
}
.toggle-chevron.open { transform: rotate(180deg); }

.usage-tips-body {
  padding: var(--space-4) var(--space-5);
}

/* 品類篩選列 */
.usage-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: var(--space-3);
}

.filter-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 99px;
  border: 1px solid var(--color-border-light);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  transition: all 0.15s;
}
.filter-pill input { display: none; }
.filter-pill.active {
  background: var(--color-sage-light, #EAF0EC);
  border-color: var(--color-sage);
  color: var(--color-sage);
  font-weight: 600;
}

.clear-filter {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--color-accent);
  cursor: pointer;
  padding: 3px 6px;
  font-family: var(--font-body);
}
.clear-filter:hover { text-decoration: underline; }

/* 步驟卡 */
.usage-steps {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-3);
}

.usage-step {
  display: flex;
  gap: 12px;
  background: var(--color-surface-alt);
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
}

.step-number {
  background: var(--color-sage);
  color: #fff;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.step-cat {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 600;
}

.step-timing {
  font-size: 11px;
  color: var(--color-sage);
  background: var(--color-surface);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  width: fit-content;
  border: 1px solid var(--color-border-light);
}

.step-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

@media (max-width: 640px) {
  .recs-header { flex-wrap: wrap; }
  .usage-steps { grid-template-columns: 1fr; }
}
</style>
