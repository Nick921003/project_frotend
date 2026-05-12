<template>
  <div class="recommendations-container">
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
              <button class="add-link-btn" @click="$emit('go-add-product', rec.category)">新增產品</button>
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
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  margin-bottom: var(--space-4);
}

.recommendations-header {
  padding: var(--space-4) var(--space-5);
  background: linear-gradient(to right, #f8fafc, #f1f5f9);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.header-left h2 {
  font-size: 18px;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.header-subtitle {
  font-size: 13px;
  color: #64748b;
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
  background: #3b82f6;
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
}

.count-label {
  font-size: 13px;
  color: #475569;
}

.recommendation-toggle {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.recommendation-toggle:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.recommendation-list {
  padding: var(--space-4) var(--space-5);
}

.recommendation-card {
  border: 1px solid #f1f5f9;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.card-header {
  background: #f8fafc;
  padding: 10px 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #f1f5f9;
}

.card-header .icon {
  font-size: 16px;
}

.ingredient-name {
  font-weight: 600;
  color: #334155;
  font-size: 14px;
}

.card-footer {
  padding: 5px 0;
}

.recommendation-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  border-bottom: 1px solid #f8fafc;
}

.recommendation-row:last-child {
  border-bottom: none;
}

.rec-text {
  font-size: 14px;
  color: #475569;
  line-height: 1.5;
}

.add-link-btn {
  background: none;
  border: 1px solid #3b82f6;
  color: #3b82f6;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.add-link-btn:hover {
  background: #eff6ff;
}

.recommendations-info {
  padding: 10px 20px;
  background: #fdf2f8;
  border-top: 1px solid #fbcfe8;
  font-size: 12px;
  color: #be185d;
}

.recommendations-collapsed-note {
  padding: 15px 20px;
  font-size: 13px;
  color: #64748b;
  text-align: center;
  font-style: italic;
}

/* Usage Tips Section */
.usage-tips-section {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
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
  background: #22c55e;
  color: white;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.usage-tips-header h3 {
  font-size: 16px;
  color: #166534;
  margin: 0;
}

.usage-steps {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}

.usage-step {
  display: flex;
  gap: 12px;
  background: white;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid #dcfce7;
}

.step-number {
  background: #22c55e;
  color: white;
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
  color: #166534;
}

.step-timing {
  font-size: 11px;
  color: #15803d;
  background: #f0fdf4;
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
}

.step-note {
  font-size: 12px;
  color: #4b5563;
  margin-top: 4px;
  line-height: 1.4;
}

@media (max-width: 640px) {
  .usage-steps {
    grid-template-columns: 1fr;
  }
}
</style>
