<template>
  <div class="new-routine-container">
    <div class="header">
      <h1>{{ isRegenerateFlow ? '🤖 AI 重新排成' : '🆕 建立新排程' }}</h1>
      <p class="subtitle">
        {{ isRegenerateFlow ? '先設定偏好，再更新目前這份排程' : '選擇方式來建立您的每週保養規劃' }}
      </p>
    </div>

    <!-- 載入狀態 -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
    </div>

    <!-- 錯誤提示 -->
    <div v-if="error" class="error-banner">
      ❌ {{ error }}
      <button @click="clearError" class="close-btn">✕</button>
    </div>

    <!-- 第一步：模式選擇 -->
    <div v-if="!loading && step === 'mode'" class="cards-grid">
      <!-- AI 自動排程卡片 -->
      <div
        class="mode-card ai-card"
        role="button"
        tabindex="0"
        :aria-disabled="loading"
        @click="!loading && selectAIMode()"
        @keydown.enter.prevent="!loading && selectAIMode()"
        @keydown.space.prevent="!loading && selectAIMode()"
      >
        <div class="card-header ai-header">
          <div class="icon">🤖</div>
          <h2>AI 自動排程</h2>
        </div>
        <div class="card-body">
          <p class="description">
            根據您的膚質、年齡、肌膚問題和現有產品，智能 AI 會自動設計最適合的週保養規劃。
          </p>
          <ul class="features">
            <li>✨ 智能分析您的肌膚需求</li>
            <li>📊 最大化利用現有產品</li>
            <li>💡 提供產品添購建議</li>
            <li>⚡ 節省規劃時間</li>
          </ul>
        </div>
        <button class="btn btn-ai" @click.stop="selectAIMode" :disabled="loading">
          下一步：配置偏好
        </button>
      </div>

      <!-- 手動排程卡片 -->
      <div
        class="mode-card manual-card"
        role="button"
        tabindex="0"
        :aria-disabled="loading"
        @click="!loading && createManual()"
        @keydown.enter.prevent="!loading && createManual()"
        @keydown.space.prevent="!loading && createManual()"
      >
        <div class="card-header manual-header">
          <div class="icon">✋</div>
          <h2>手動建立</h2>
        </div>
        <div class="card-body">
          <p class="description">
            自由組合您的保養品，手動安排每週保養排程。完全掌控您的保養計劃。
          </p>
          <ul class="features">
            <li>🎨 自由客製化排程</li>
            <li>🔧 隨時調整順序</li>
            <li>👥 完全自主控制</li>
            <li>⏰ 按需求修改時間</li>
          </ul>
        </div>
        <button class="btn btn-manual" @click.stop="createManual" :disabled="loading">
          {{ loading ? '準備中...' : '手動建立' }}
        </button>
      </div>
    </div>

    <!-- 第二步：AI 偏好配置 -->
    <div v-if="!loading && step === 'preferences'" class="preferences-form">
      <button @click="backToMode" class="btn-back">← 返回選擇</button>
      
      <div class="form-card">
        <h2>⚙️ 配置排程偏好</h2>
        <p class="form-description">自訂您希望的保養風格和優先順序</p>

        <!-- 保養複雜度 -->
        <div class="form-group">
          <label>保養複雜度</label>
          <div class="option-cards">
            <label
              v-for="opt in complexityOptions"
              :key="opt.value"
              class="option-card"
              :class="{ selected: preferences.complexity === opt.value }"
            >
              <input
                class="native-radio"
                type="radio"
                name="complexity"
                :value="opt.value"
                v-model="preferences.complexity"
              />
              <div class="option-main" role="button" tabindex="0">
                <div class="option-icon">{{ opt.icon }}</div>
                <div class="option-label">{{ opt.label }}</div>
                <div class="option-desc">{{ opt.description }}</div>
              </div>
            </label>
          </div>
        </div>

        <!-- 肌膚問題（多選） -->
        <div class="form-group">
          <label>針對的肌膚問題（多選）</label>
          <div class="checkbox-group">
            <label v-for="issue in availableIssues" :key="issue" class="checkbox-label">
              <input
                type="checkbox"
                :value="issue"
                v-model="preferences.targetIssues"
              />
              <span>{{ issue }}</span>
            </label>
          </div>
        </div>

        <!-- 優先順序 -->
        <div class="form-group">
          <label>優先順序</label>
          <div class="option-cards">
            <label
              v-for="opt in priorityOptions"
              :key="opt.value"
              class="option-card"
              :class="{ selected: preferences.priority === opt.value }"
            >
              <input
                class="native-radio"
                type="radio"
                name="priority"
                :value="opt.value"
                v-model="preferences.priority"
              />
              <div class="option-main" role="button" tabindex="0">
                <div class="option-icon">{{ opt.icon }}</div>
                <div class="option-label">{{ opt.label }}</div>
              </div>
            </label>
          </div>
        </div>

        <p class="selection-hint">
          已選肌膚問題：{{ preferences.targetIssues.length }} 項
        </p>

        <!-- 推薦設定 -->
        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="preferences.allowRecommendations"
            />
            <span>允許 AI 推薦新產品（當現有產品不足時）</span>
          </label>
        </div>

        <!-- 提交按鈕 -->
        <div class="form-actions">
          <button @click="createWithAI" class="btn btn-primary">
            {{ isRegenerateFlow ? '🤖 用此配置更新目前排程' : '🤖 用此配置生成排程' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 資訊區段 -->
    <div v-if="step === 'mode'" class="info-section">
      <h3>💡 如何選擇？</h3>
      <div class="info-content">
        <div class="info-item">
          <strong>建議使用 AI 自動排程：</strong>
          <p>如果您希望快速得到專業的保養建議，或不確定該如何安排保養順序。</p>
        </div>
        <div class="info-item">
          <strong>推薦手動建立：</strong>
          <p>如果您已有清晰的保養理念，想要完全自主控制每個細節。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCreateRoutine } from '~/composables/useCreateRoutine';
import type { RoutinePreferences } from '~/types/routine';

const router = useRouter();
const route = useRoute();
const { routine, loading, error, generateWithAI, generateDefault, getDefaultPreferences } = useCreateRoutine();

const step = ref<'mode' | 'preferences'>('mode');
const loadingMessage = ref('');
const preferences = ref<RoutinePreferences>(getDefaultPreferences());

const isRegenerateFlow = computed(() => route.query.action === 'regenerate');
const targetRoutineId = computed(() => {
  const value = route.query.routineId;
  return typeof value === 'string' ? value : '';
});
const MAX_ROUTINES = 3;
const AI_REGENERATE_TIMEOUT_MS = 180000;

// 配置選項
const complexityOptions = [
  { value: 'minimal', label: '精簡版', icon: '🚀', description: '快速簡潔' },
  { value: 'standard', label: '標準版', icon: '⭐', description: '推薦方案' },
  { value: 'comprehensive', label: '完整版', icon: '💎', description: '深層呵護' }
];

const availableIssues = [
  '痘痘',
  '粉刺',
  '敏感',
  '暗沉',
  '細紋',
  '乾燥',
  '出油',
  '黑眼圈'
];

const priorityOptions = [
  { value: 'speed', label: '快速', icon: '⚡', description: '節省時間' },
  { value: 'effectiveness', label: '有效性', icon: '🎯', description: '效果第一' },
  { value: 'affordability', label: '經濟', icon: '💰', description: '節省成本' }
];

const redirectToLimitNotice = () => {
  router.push({
    path: '/beauty-plan',
    query: {
      limit: '1',
      max: String(MAX_ROUTINES)
    }
  });
};

const checkRoutineLimit = async () => {
  const response = await $fetch<{ success: boolean; data: any[] }>('/api/routines/list');
  const count = Array.isArray(response?.data) ? response.data.length : 0;
  return count >= MAX_ROUTINES;
};

const ensureCanCreateRoutine = async (): Promise<boolean> => {
  try {
    const isAtLimit = await checkRoutineLimit();
    if (isAtLimit) {
      redirectToLimitNotice();
      return false;
    }
    return true;
  } catch {
    // 若查詢失敗，不阻擋建立流程，由後端最終防呆
    return true;
  }
};

/**
 * 選擇 AI 模式後進入配置
 */
const selectAIMode = async () => {
  if (loading.value) return;

  loading.value = true;
  loadingMessage.value = '⏳ 檢查排程數量...';

  const canCreate = await ensureCanCreateRoutine();
  loading.value = false;

  if (!canCreate) return;

  preferences.value = getDefaultPreferences();
  step.value = 'preferences';
};

/**
 * 返回模式選擇
 */
const backToMode = () => {
  step.value = 'mode';
};

/**
 * 使用配置生成排程
 */
const createWithAI = async () => {
  if (loading.value) return;

  if (!isRegenerateFlow.value) {
    const canCreate = await ensureCanCreateRoutine();
    if (!canCreate) return;
  }
  
  loading.value = true;
  loadingMessage.value = isRegenerateFlow.value
    ? '🤖 AI 正在更新目前排程（可能需要 1~3 分鐘）...'
    : '🤖 AI 正在分析您的肌膚資料並生成排程...';
  
  try {
    if (isRegenerateFlow.value && targetRoutineId.value) {
      const response = await $fetch<{
        success: boolean;
        changed: boolean;
        changed_count: number;
        threshold: number;
        message: string;
        data?: {
          recommendations?: Array<{
            product_name: string;
            product_category?: string;
            ingredients?: string[];
            recommendation_reason?: string;
          }>;
        };
      }>(`/api/routines/${targetRoutineId.value}/regenerate`, {
        method: 'POST',
        body: {
          preferences: preferences.value
        },
        timeout: AI_REGENERATE_TIMEOUT_MS
      });

      if (!response.success) {
        throw new Error(response.message || '更新排程失敗');
      }

      const recommendations = Array.isArray(response.data?.recommendations)
        ? response.data!.recommendations!
        : [];

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          `routine-ai-recommendations:${targetRoutineId.value}`,
          JSON.stringify(recommendations)
        );
      }

      loadingMessage.value = `✅ 已產生 ${recommendations.length} 項 AI 推薦（不自動改動排程）`;

      setTimeout(() => {
        router.push({
          path: `/routines/${targetRoutineId.value}`,
          query: {
            regenResult: 'recommended',
            recCount: String(recommendations.length)
          }
        });
        loading.value = false;
      }, 500);

      return;
    }

    await generateWithAI(preferences.value);
    
    if (routine.value && routine.value.routine_id) {
      const createdRecommendations = Array.isArray(routine.value.recommendations)
        ? routine.value.recommendations
        : [];

      if (typeof window !== 'undefined' && createdRecommendations.length > 0) {
        sessionStorage.setItem(
          `routine-ai-recommendations:${routine.value.routine_id}`,
          JSON.stringify(createdRecommendations)
        );
      }

      loadingMessage.value = '✅ 排程已生成，正在跳轉...';
      
      setTimeout(() => {
        router.push({
          path: `/routines/${routine.value!.routine_id}`,
          query: createdRecommendations.length > 0
            ? {
                regenResult: 'recommended',
                recCount: String(createdRecommendations.length)
              }
            : {}
        });
        loading.value = false;
      }, 500);
    } else {
      error.value = '排程生成失敗，無法取得排程 ID';
      loading.value = false;
      step.value = 'preferences'; // 返回配置頁面
    }
  } catch (err: any) {
    console.error('[createWithAI] 錯誤:', err);
    loading.value = false;

    const isTimeout = err?.name === 'TimeoutError' || String(err?.message || '').toLowerCase().includes('timeout');
    if (isTimeout) {
      error.value = 'AI 重新排成逾時（3 分鐘），請稍後再試一次。';
      step.value = 'preferences';
      return;
    }

    const isLimitError = err?.statusCode === 409 || err?.response?.status === 409;
    if (!isRegenerateFlow.value && isLimitError) {
      redirectToLimitNotice();
      return;
    }

    error.value = err.data?.message || err.message || 'AI 生成失敗，請檢查個人資料是否完整';
    step.value = 'preferences'; // 返回配置頁面
  }
};

/**
 * 手動建立排程
 */
const createManual = async () => {
  if (loading.value) return;

  const canCreate = await ensureCanCreateRoutine();
  if (!canCreate) return;

  loading.value = true;
  loadingMessage.value = '⏳ 準備預設排程...';

  try {
    await generateDefault();

    if (routine.value && routine.value.routine_id) {
      loadingMessage.value = '✅ 準備完成，正在跳轉...';

      setTimeout(() => {
        router.push(`/routines/${routine.value!.routine_id}`);
        loading.value = false;
      }, 500);
    } else {
      error.value = '排程準備失敗，無法取得排程 ID';
      loading.value = false;
    }
  } catch (err: any) {
    console.error('[createManual] 生成錯誤:', err);
    loading.value = false;

    const isLimitError = err?.statusCode === 409 || err?.response?.status === 409;
    if (isLimitError) {
      redirectToLimitNotice();
      return;
    }

    error.value = err.data?.message || err.message || '排程準備失敗';
  }
};

/**
 * 清除錯誤信息
 */
const clearError = () => {
  error.value = null;
};

onMounted(() => {
  if (isRegenerateFlow.value && targetRoutineId.value) {
    step.value = 'preferences';
    preferences.value = getDefaultPreferences();
  }
});
</script>

<style scoped>
.new-routine-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  color: #2c3e50;
  font-size: 2.5rem;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: #7f8c8d;
  font-size: 1.1rem;
  margin: 0;
}

/* 載入狀態 */
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
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-overlay p {
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
}

/* 錯誤提示 */
.error-banner {
  max-width: 1000px;
  margin: 0 auto 2rem;
  padding: 1rem 1.5rem;
  background: #fadbd8;
  border: 2px solid #e74c3c;
  border-radius: 8px;
  color: #c0392b;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  color: #c0392b;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
}

/* 卡片網格 */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.mode-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: default;
  display: flex;
  flex-direction: column;
  border: 2px solid transparent;
}

.mode-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.mode-card.ai-card {
  border-color: #3498db;
}

.mode-card.ai-card:hover {
  border-color: #2980b9;
}

.mode-card.manual-card {
  border-color: #f39c12;
}

.mode-card.manual-card:hover {
  border-color: #e67e22;
}

.card-header {
  padding: 2rem;
  text-align: center;
}

.ai-header {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
}

.manual-header {
  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
  color: white;
}

.card-header .icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.card-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.card-body {
  padding: 1.5rem 2rem;
  flex: 1;
}

.description {
  color: #5d6d7b;
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0 0 1.5rem 0;
}

.features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.features li {
  color: #34495e;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn {
  padding: 0.875rem 2rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: auto;
  align-self: stretch;
}

.btn-ai {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
}

.btn-ai:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
}

.btn-ai:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-manual {
  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
  color: white;
}

.btn-manual:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(243, 156, 18, 0.4);
}

.btn-manual:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 偏好設定區塊 */
.preferences-form {
  max-width: 900px;
  margin: 0 auto;
}

.btn-back {
  border: none;
  background: #e2e8f0;
  color: #334155;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 1rem;
}

.form-card {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.form-description {
  color: #64748b;
  margin: 0.25rem 0 1.25rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group > label {
  display: block;
  margin-bottom: 0.6rem;
  color: #1f2937;
  font-weight: 700;
}

.option-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.option-card {
  display: block;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-card:hover {
  transform: translateY(-1px);
  border-color: #64748b;
}

.option-card.selected {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.native-radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.option-main {
  width: 100%;
  padding: 0.8rem 0.9rem;
}

.option-icon {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.option-label {
  font-weight: 700;
  color: #1f2937;
}

.option-desc {
  margin-top: 0.2rem;
  color: #64748b;
  font-size: 0.85rem;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  background: #fff;
  cursor: pointer;
  color: #334155;
}

.checkbox-label input {
  accent-color: #2563eb;
}

.selection-hint {
  margin: -0.25rem 0 1rem;
  color: #64748b;
  font-size: 0.9rem;
}

.form-actions {
  margin-top: 1.2rem;
}

.btn-primary {
  width: 100%;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff;
}

/* 資訊區段 */
.info-section {
  max-width: 900px;
  margin: 3rem auto 0;
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.info-section h3 {
  color: #2c3e50;
  margin-top: 0;
  font-size: 1.2rem;
  border-bottom: 2px solid #ecf0f1;
  padding-bottom: 1rem;
}

.info-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.info-item {
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.info-item:nth-child(2) {
  border-left-color: #f39c12;
}

.info-item strong {
  color: #2c3e50;
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.info-item p {
  color: #7f8c8d;
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .new-routine-container {
    padding: 1rem;
  }

  .header h1 {
    font-size: 1.75rem;
  }

  .cards-grid {
    grid-template-columns: 1fr;
  }

  .info-content {
    grid-template-columns: 1fr;
  }

  .mode-card:hover {
    transform: translateY(-4px);
  }
}
</style>
