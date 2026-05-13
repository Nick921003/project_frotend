<template>
  <div class="recommendations-container">
    <!-- 建議添購區塊（AI 推薦） -->
    <div v-if="unifiedRecommendations.length > 0" class="recommendations-section">
      <div class="recommendations-header">
        <div class="header-left">
          <h2>AI 推薦補充</h2>
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
            <div class="ingredient-name">品類與推薦成分（不自動加入）</div>
          </div>
          <div class="card-footer">
            <div v-for="rec in unifiedRecommendations" :key="`${rec.category}-${rec.productName}`" class="missing-item-row recommendation-row">
              <div class="rec-text">
                <strong>{{ rec.category }}</strong>
                <span>：{{ rec.ingredientsText }}</span>
                <span v-if="rec.reason" class="rec-reason">{{ rec.reason }}</span>
              </div>
              <button class="add-link-btn" @click="$emit('go-add-product', rec.category)">新增產品</button>
            </div>
          </div>
        </div>
      </div>

      <div v-show="showRecommendations" class="recommendations-info">
        <p>建議僅供參考，不會自動加入排程；新增產品後請手動點擊「AI 重新排成」。</p>
      </div>
      <div v-show="!showRecommendations" class="recommendations-collapsed-note">
        <p>AI 推薦已收起，點擊「展開推薦」可再次查看內容。</p>
      </div>
    </div>

    <!-- 使用順序建議（產品充足時） -->
    <div v-if="isProductsSufficient" class="usage-tips-section">
      <div class="usage-tips-header">
        <span class="sufficient-badge">· 產品完整</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { UnifiedRecommendation, UsageOrderTip } from '~/composables/useRoutineRecommendations';

defineProps<{
  unifiedRecommendations: UnifiedRecommendation[];
  isProductsSufficient: boolean;
  usageOrderTips: UsageOrderTip[];
  routineId: string;
}>();

defineEmits<{
  (e: 'go-add-product', category: string): void;
}>();

const showRecommendations = ref(true);
</script>

<style scoped>
.recommendations-container {
  margin-bottom: var(--space-6);
}

/* Recommendations Section */
.recommendations-section {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-4);
}

.recommendations-header {
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface-alt);
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.header-left h2 {
  font-size: 16px;
  color: var(--color-text-primary);
  margin: 0 0 4px 0;
  font-family: var(--font-heading);
}

.header-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.recommendation-tools {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.recommendation-count {
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-badge {
  background: var(--color-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

.count-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.recommendation-toggle {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font-body);
}

.recommendation-toggle:hover {
  background: var(--color-surface-alt);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.recommendation-list {
  padding: var(--space-4) var(--space-5);
}

.recommendation-card {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.card-header {
  background: var(--color-surface-alt);
  padding: 10px 15px;
  border-bottom: 1px solid var(--color-border-light);
}

.ingredient-name {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.card-footer {
  padding: 5px 0;
}

.recommendation-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  border-bottom: 1px solid var(--color-border-light);
}

.recommendation-row:last-child {
  border-bottom: none;
}

.rec-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.rec-reason {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
  margin-top: 2px;
}

.add-link-btn {
  background: none;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--font-body);
}

.add-link-btn:hover {
  background: var(--color-accent-light);
}

.recommendations-info {
  padding: 10px 20px;
  background: var(--color-surface-alt);
  border-top: 1px solid var(--color-border-light);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.recommendations-collapsed-note {
  padding: 15px 20px;
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
}

/* Usage Tips Section */
.usage-tips-section {
  background: var(--color-sage-light);
  border: 1px solid #C0D8C5;
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  margin-bottom: var(--space-4);
}

.usage-tips-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--space-4);
}

.sufficient-badge {
  background: var(--color-sage);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  letter-spacing: 0.05em;
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

@media (max-width: 768px) {
  .recommendations-header {
    padding: var(--space-3) var(--space-4);
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .header-left h2 { font-size: 14px; }
  .header-subtitle { font-size: 12px; }
  .count-label { font-size: 11px; }
  .recommendation-toggle { padding: 3px 10px; font-size: 11px; }
  .recommendation-list { padding: var(--space-3) var(--space-4); }
}

@media (max-width: 640px) {
  .usage-steps {
    grid-template-columns: 1fr;
  }
}
</style>
