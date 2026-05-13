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
        <button class="add-link-btn" @click="$emit('go-add-product', '')">
          前往新增產品
        </button>
      </div>
    </div>

    <!-- 使用順序建議 -->
    <div class="usage-tips-section">
      <div class="usage-tips-header">
        <h3>建議使用順序</h3>
      </div>
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

<script setup lang="ts">
import type { EfficacyRecommendation } from '~/composables/useRoutineRecommendations';
import { USAGE_ORDER_TIPS } from '~/composables/useRoutineRecommendations';

defineProps<{
  efficacyRecs: EfficacyRecommendation[];
  recsLoading: boolean;
  usageOrderTips: typeof USAGE_ORDER_TIPS;
  routineId: string;
}>();

defineEmits<{
  (e: 'go-add-product', category: string): void;
}>();
</script>

<style scoped>
.recommendations-container {
  margin-bottom: var(--space-6);
}

/* 功效推薦區 */
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
}

.recs-header h2 {
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

.recs-loading,
.recs-empty {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: var(--space-5);
  text-align: center;
}

.recs-list {
  padding: var(--space-4) var(--space-5);
}

.rec-card {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  background: var(--color-surface);
}

.rec-issue {
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 600;
  margin-bottom: 4px;
}

.rec-category {
  font-size: 14px;
  margin-bottom: 4px;
  color: var(--color-text-primary);
}

.rec-ingredients {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.ing-chip {
  display: inline-block;
  background: var(--color-surface-alt);
  border-radius: 99px;
  padding: 1px 8px;
  margin: 0 2px;
  font-size: 11px;
}

.rec-reason {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
  margin: 0;
  line-height: 1.5;
}

.add-link-btn {
  background: none;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--font-body);
  margin-top: var(--space-2);
}

.add-link-btn:hover {
  background: var(--color-surface-alt);
}

/* 使用順序區 */
.usage-tips-section {
  background: var(--color-sage-light);
  border: 1px solid #C0D8C5;
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  margin-bottom: var(--space-4);
}

.usage-tips-header {
  margin-bottom: var(--space-4);
}

.usage-tips-header h3 {
  font-size: 15px;
  color: var(--color-text-primary);
  margin: 0;
  font-family: var(--font-heading);
}

.usage-steps {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}

.usage-step {
  display: flex;
  gap: 12px;
  background: var(--color-surface);
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid #C8DEC8;
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
  gap: 2px;
}

.step-cat {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 600;
}

.step-timing {
  font-size: 11px;
  color: var(--color-sage);
  background: var(--color-sage-light);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  width: fit-content;
  border: 1px solid #C0D8C5;
}

.step-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

@media (max-width: 640px) {
  .usage-steps {
    grid-template-columns: 1fr;
  }
}
</style>
