<template>
  <div class="new-routine-wrap">

    <!-- 載入遮罩 -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p class="loading-msg">{{ loadingMessage }}</p>
    </div>

    <div class="page-container">
      <div class="page-header">
        <h1 class="page-heading">{{ isRegenerateFlow ? 'AI 重新排成' : '建立新排程' }}</h1>
        <p class="subtitle">
          {{ isRegenerateFlow ? '先設定偏好，再更新目前這份排程' : '選擇方式來建立您的每週保養規劃' }}
        </p>
      </div>

      <!-- 錯誤提示 -->
      <div v-if="error" class="alert-block alert-red error-row">
        <span>❌ {{ error }}</span>
        <button class="close-btn" @click="clearError">✕</button>
      </div>

      <!-- 步驟一：模式選擇 -->
      <div v-if="!loading && step === 'mode'" class="cards-grid">
        <!-- AI 卡片 -->
        <div
          class="mode-card mode-card--ai"
          role="button"
          tabindex="0"
          :aria-disabled="loading"
          @click="!loading && selectAIMode()"
          @keydown.enter.prevent="!loading && selectAIMode()"
          @keydown.space.prevent="!loading && selectAIMode()"
        >
          <div class="mode-card__header mode-card__header--ai">
            <div class="mode-icon">🤖</div>
            <h2>AI 自動排程</h2>
          </div>
          <div class="mode-card__body">
            <p class="mode-desc">根據您的膚質、年齡、肌膚問題和現有產品，AI 會自動設計最適合的週保養規劃。</p>
            <ul class="mode-features">
              <li>智能分析您的肌膚需求</li>
              <li>📊 最大化利用現有產品</li>
              <li>💡 提供產品添購建議</li>
              <li>⚡ 節省規劃時間</li>
            </ul>
          </div>
          <button class="btn btn-primary mode-btn" :disabled="loading" @click.stop="selectAIMode">
            下一步：配置偏好
          </button>
        </div>

        <!-- 手動卡片 -->
        <div
          class="mode-card mode-card--manual"
          role="button"
          tabindex="0"
          :aria-disabled="loading"
          @click="!loading && createManual()"
          @keydown.enter.prevent="!loading && createManual()"
          @keydown.space.prevent="!loading && createManual()"
        >
          <div class="mode-card__header mode-card__header--manual">
            <div class="mode-icon">✋</div>
            <h2>手動建立</h2>
          </div>
          <div class="mode-card__body">
            <p class="mode-desc">自由組合您的保養品，手動安排每週保養排程。完全掌控您的保養計劃。</p>
            <ul class="mode-features">
              <li>🎨 自由客製化排程</li>
              <li>🔧 隨時調整順序</li>
              <li>👥 完全自主控制</li>
              <li>⏰ 按需求修改時間</li>
            </ul>
          </div>
          <button class="btn btn-ghost mode-btn" :disabled="loading" @click.stop="createManual">
            {{ loading ? '準備中...' : '手動建立' }}
          </button>
        </div>
      </div>

      <!-- 步驟二：AI 偏好配置 -->
      <div v-if="!loading && step === 'preferences'" class="preferences-wrap">
        <button class="btn btn-secondary btn-sm back-btn" @click="backToMode">← 返回選擇</button>

        <div class="card pref-card">
          <h2 class="section-title" style="font-size: 18px;">配置排程偏好</h2>
          <p class="pref-desc">自訂您希望的保養風格和優先順序</p>

          <div class="form-group">
            <label class="form-label">保養複雜度</label>
            <div class="option-cards">
              <label
                v-for="opt in complexityOptions"
                :key="opt.value"
                class="option-card"
                :class="{ 'option-card--selected': preferences.complexity === opt.value }"
              >
                <input
                  class="native-radio"
                  type="radio"
                  name="complexity"
                  :value="opt.value"
                  v-model="preferences.complexity"
                />
                <div class="option-main">
                  <div class="option-icon">{{ opt.icon }}</div>
                  <div class="option-label">{{ opt.label }}</div>
                  <div class="option-desc-text">{{ opt.description }}</div>
                </div>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">針對的肌膚問題（多選）</label>
            <div class="checkbox-group">
              <label v-for="issue in availableIssues" :key="issue" class="checkbox-pill">
                <input type="checkbox" :value="issue" v-model="preferences.targetIssues" />
                <span>{{ issue }}</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">優先順序</label>
            <div class="option-cards">
              <label
                v-for="opt in priorityOptions"
                :key="opt.value"
                class="option-card"
                :class="{ 'option-card--selected': preferences.priority === opt.value }"
              >
                <input
                  class="native-radio"
                  type="radio"
                  name="priority"
                  :value="opt.value"
                  v-model="preferences.priority"
                />
                <div class="option-main">
                  <div class="option-icon">{{ opt.icon }}</div>
                  <div class="option-label">{{ opt.label }}</div>
                </div>
              </label>
            </div>
          </div>

          <p class="selection-hint">已選肌膚問題：{{ preferences.targetIssues.length }} 項</p>

          <div class="form-group">
            <label class="checkbox-pill">
              <input type="checkbox" v-model="preferences.allowRecommendations" />
              <span>允許 AI 推薦新產品（當現有產品不足時）</span>
            </label>
          </div>

          <div class="pref-actions">
            <button class="btn btn-primary btn-lg" @click="createWithAI">
              {{ isRegenerateFlow ? '🤖 用此配置更新目前排程' : '🤖 用此配置生成排程' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 說明區段 -->
      <div v-if="step === 'mode'" class="card info-card">
        <h3 class="section-title" style="font-size: 16px;">如何選擇？</h3>
        <div class="info-grid">
          <div class="info-item info-item--ai">
            <strong>建議使用 AI 自動排程</strong>
            <p>如果您希望快速得到專業的保養建議，或不確定該如何安排保養順序。</p>
          </div>
          <div class="info-item info-item--manual">
            <strong>推薦手動建立</strong>
            <p>如果您已有清晰的保養理念，想要完全自主控制每個細節。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCreateRoutine } from '~/composables/useCreateRoutine'
import type { RoutinePreferences } from '~/types/routine'

const router = useRouter()
const route = useRoute()
const { routine, loading, error, generateWithAI, generateDefault, getDefaultPreferences } = useCreateRoutine()

const step = ref<'mode' | 'preferences'>('mode')
const loadingMessage = ref('')
const preferences = ref<RoutinePreferences>(getDefaultPreferences())

const isRegenerateFlow = computed(() => route.query.action === 'regenerate')
const targetRoutineId = computed(() => {
  const value = route.query.routineId
  return typeof value === 'string' ? value : ''
})
const MAX_ROUTINES = 3
const AI_REGENERATE_TIMEOUT_MS = 180000

const complexityOptions = [
  { value: 'minimal', label: '精簡版', icon: '🚀', description: '快速簡潔' },
  { value: 'standard', label: '標準版', icon: '⭐', description: '推薦方案' },
  { value: 'comprehensive', label: '完整版', icon: '💎', description: '深層呵護' }
]

const availableIssues = ['痘痘', '粉刺', '敏感', '暗沉', '細紋', '乾燥', '出油', '黑眼圈']

const priorityOptions = [
  { value: 'speed', label: '快速', icon: '⚡', description: '節省時間' },
  { value: 'effectiveness', label: '有效性', icon: '🎯', description: '效果第一' },
  { value: 'affordability', label: '經濟', icon: '💰', description: '節省成本' }
]

const redirectToLimitNotice = () => {
  router.push({ path: '/beauty-plan', query: { limit: '1', max: String(MAX_ROUTINES) } })
}

const checkRoutineLimit = async () => {
  const response = await $fetch<{ success: boolean; data: any[] }>('/api/routines/list')
  const count = Array.isArray(response?.data) ? response.data.length : 0
  return count >= MAX_ROUTINES
}

const ensureCanCreateRoutine = async (): Promise<boolean> => {
  try {
    const isAtLimit = await checkRoutineLimit()
    if (isAtLimit) { redirectToLimitNotice(); return false }
    return true
  } catch {
    return true
  }
}

const selectAIMode = async () => {
  if (loading.value) return
  loading.value = true
  loadingMessage.value = '⏳ 檢查排程數量...'
  const canCreate = await ensureCanCreateRoutine()
  loading.value = false
  if (!canCreate) return
  preferences.value = getDefaultPreferences()
  step.value = 'preferences'
}

const backToMode = () => { step.value = 'mode' }

const createWithAI = async () => {
  if (loading.value) return

  if (!isRegenerateFlow.value) {
    const canCreate = await ensureCanCreateRoutine()
    if (!canCreate) return
  }

  loading.value = true
  loadingMessage.value = isRegenerateFlow.value
    ? '🤖 AI 正在更新目前排程（可能需要 1~3 分鐘）...'
    : '🤖 AI 正在分析您的肌膚資料並生成排程...'

  try {
    if (isRegenerateFlow.value && targetRoutineId.value) {
      const response = await $fetch<{
        success: boolean; changed: boolean; changed_count: number;
        threshold: number; message: string;
        data?: { recommendations?: Array<{ product_name: string; product_category?: string; ingredients?: string[]; recommendation_reason?: string }> }
      }>(`/api/routines/${targetRoutineId.value}/regenerate`, {
        method: 'POST', body: { preferences: preferences.value }, timeout: AI_REGENERATE_TIMEOUT_MS
      })

      if (!response.success) throw new Error(response.message || '更新排程失敗')

      const recommendations = Array.isArray(response.data?.recommendations) ? response.data!.recommendations! : []
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`routine-ai-recommendations:${targetRoutineId.value}`, JSON.stringify(recommendations))
      }

      loadingMessage.value = `✅ 已產生 ${recommendations.length} 項 AI 推薦`
      setTimeout(() => {
        router.push({ path: `/routines/${targetRoutineId.value}`, query: { regenResult: 'recommended', recCount: String(recommendations.length) } })
        loading.value = false
      }, 500)
      return
    }

    await generateWithAI(preferences.value)

    if (routine.value && routine.value.routine_id) {
      const createdRecs = Array.isArray(routine.value.recommendations) ? routine.value.recommendations : []
      if (typeof window !== 'undefined' && createdRecs.length > 0) {
        sessionStorage.setItem(`routine-ai-recommendations:${routine.value.routine_id}`, JSON.stringify(createdRecs))
      }
      loadingMessage.value = '✅ 排程已生成，正在跳轉...'
      setTimeout(() => {
        router.push({ path: `/routines/${routine.value!.routine_id}`, query: createdRecs.length > 0 ? { regenResult: 'recommended', recCount: String(createdRecs.length) } : {} })
        loading.value = false
      }, 500)
    } else {
      error.value = '排程生成失敗，無法取得排程 ID'
      loading.value = false
      step.value = 'preferences'
    }
  } catch (err: any) {
    loading.value = false
    const isTimeout = err?.name === 'TimeoutError' || String(err?.message || '').toLowerCase().includes('timeout')
    if (isTimeout) { error.value = 'AI 重新排成逾時（3 分鐘），請稍後再試一次。'; step.value = 'preferences'; return }
    const isLimitError = err?.statusCode === 409 || err?.response?.status === 409
    if (!isRegenerateFlow.value && isLimitError) { redirectToLimitNotice(); return }
    error.value = err.data?.message || err.message || 'AI 生成失敗，請檢查個人資料是否完整'
    step.value = 'preferences'
  }
}

const createManual = async () => {
  if (loading.value) return
  const canCreate = await ensureCanCreateRoutine()
  if (!canCreate) return

  loading.value = true
  loadingMessage.value = '⏳ 準備預設排程...'

  try {
    await generateDefault()
    if (routine.value && routine.value.routine_id) {
      loadingMessage.value = '✅ 準備完成，正在跳轉...'
      setTimeout(() => { router.push(`/routines/${routine.value!.routine_id}`); loading.value = false }, 500)
    } else {
      error.value = '排程準備失敗，無法取得排程 ID'
      loading.value = false
    }
  } catch (err: any) {
    loading.value = false
    const isLimitError = err?.statusCode === 409 || err?.response?.status === 409
    if (isLimitError) { redirectToLimitNotice(); return }
    error.value = err.data?.message || err.message || '排程準備失敗'
  }
}

const clearError = () => { error.value = null }

onMounted(() => {
  if (isRegenerateFlow.value && targetRoutineId.value) {
    step.value = 'preferences'
    preferences.value = getDefaultPreferences()
  }
})
</script>

<style scoped>
.new-routine-wrap {
  min-height: 100vh;
}

.page-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.page-heading {
  font-size: 28px;
  margin-bottom: var(--space-2);
}

.subtitle {
  color: var(--color-text-secondary);
  font-size: 15px;
  margin: 0;
}

/* Loading overlay */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(58, 50, 45, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(160, 112, 96, 0.3);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  margin-bottom: var(--space-4);
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-msg {
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
  margin: 0;
}

/* Error row */
.error-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-red);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  flex-shrink: 0;
}

/* Mode cards grid */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.mode-card {
  background: var(--color-surface);
  border: 2px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.mode-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
}

.mode-card--ai:hover { border-color: var(--color-accent); }
.mode-card--manual:hover { border-color: var(--color-amber); }

.mode-card__header {
  padding: var(--space-6);
  text-align: center;
}

.mode-card__header--ai {
  background: var(--color-accent-light);
  border-bottom: 1px solid #E8D0C8;
}

.mode-card__header--manual {
  background: var(--color-amber-light);
  border-bottom: 1px solid #DDB880;
}

.mode-card__header h2 {
  font-size: 20px;
  margin: 0;
  color: var(--color-text-primary);
}

.mode-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
}

.mode-card__body {
  padding: var(--space-5) var(--space-6);
  flex: 1;
}

.mode-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 0 0 var(--space-4);
}

.mode-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mode-features li {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.mode-btn {
  margin: var(--space-5) var(--space-6) var(--space-6);
}

/* Preferences */
.preferences-wrap {
  max-width: 800px;
  margin: 0 auto;
}

.back-btn {
  margin-bottom: var(--space-4);
}

.pref-card {
  margin-bottom: var(--space-6);
}

.pref-desc {
  color: var(--color-text-secondary);
  font-size: 14px;
  margin: calc(-1 * var(--space-2)) 0 var(--space-5);
}

.option-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
}

.option-card {
  display: block;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-alt);
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
}

.option-card:hover {
  border-color: var(--color-accent);
}

.option-card--selected {
  border-color: var(--color-accent);
  background: var(--color-accent-light);
}

.native-radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.option-main {
  padding: var(--space-3) var(--space-4);
}

.option-icon { font-size: 1.3rem; margin-bottom: 4px; }

.option-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
}

.option-desc-text {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.checkbox-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  background: var(--color-surface);
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  transition: border-color 0.15s, background 0.15s;
}

.checkbox-pill:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.checkbox-pill input {
  accent-color: var(--color-accent);
}

.selection-hint {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: calc(-1 * var(--space-2)) 0 var(--space-4);
}

.pref-actions { margin-top: var(--space-4); }
.pref-actions .btn { width: 100%; }

/* Info card */
.info-card {
  background: var(--color-surface-alt);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.info-item {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border-left: 3px solid;
}

.info-item--ai {
  background: var(--color-accent-light);
  border-left-color: var(--color-accent);
}

.info-item--manual {
  background: var(--color-amber-light);
  border-left-color: var(--color-amber);
}

.info-item strong {
  display: block;
  font-size: 14px;
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.info-item p {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.6;
}

@media (max-width: 600px) {
  .cards-grid { grid-template-columns: 1fr; }
  .info-grid { grid-template-columns: 1fr; }
}
</style>
