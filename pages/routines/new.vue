<template>
  <div class="new-routine-wrap">

    <!-- 載入遮罩移除（此頁不再有長時間 loading） -->

    <div class="page-container">
      <div class="page-header">
        <h1 class="page-heading">AI 成分推薦</h1>
        <p class="subtitle">分析您現有保養品的成分覆蓋，找出功效缺口，給出補充建議</p>
      </div>

      <!-- 錯誤提示 -->
      <div v-if="error" class="alert-block alert-red error-row">
        <span>❌ {{ error }}</span>
        <button class="close-btn" @click="clearError">✕</button>
      </div>

      <!-- 困擾與品類選擇 -->
      <div v-if="step === 'recs-concerns'" class="preferences-wrap">
        <button class="btn btn-secondary btn-sm back-btn" @click="router.back()">← 返回排程</button>
        <div class="card pref-card">
          <h2 class="section-title" style="font-size: 18px;">🔍 AI 成分推薦</h2>
          <p class="pref-desc">AI 會根據您的<strong>肌質、性別</strong>與現有保養品成分，找出功效缺口，給出 2–4 條針對性証品建議</p>

          <!-- 是否包含個人困擾 toggle -->
          <div class="toggle-row">
            <label class="toggle-switch">
              <input type="checkbox" v-model="useProfileIssues" />
              <span class="toggle-track"></span>
            </label>
            <div class="toggle-info">
              <span class="toggle-label">包含個人資料中的困擾</span>
              <span class="toggle-hint">
                {{ useProfileIssues ? '會合並下方手選困擾一起分析' : '僅使用下方手選的困擾，若不選則分析全部' }}
              </span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">肌膚困擾（多選）</label>
            <div class="checkbox-group">
              <label v-for="issue in availableIssues" :key="issue" class="checkbox-pill"
                :class="{ 'checkbox-pill--selected': recsIssues.includes(issue) }">
                <input type="checkbox" :value="issue" v-model="recsIssues" />
                <span>{{ issue }}</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">想要推薦的品類（多選，不選則分析全部）</label>
            <div class="checkbox-group">
              <label v-for="cat in recommendableCategories" :key="cat" class="checkbox-pill"
                :class="{ 'checkbox-pill--selected': recsCategories.includes(cat) }">
                <input type="checkbox" :value="cat" v-model="recsCategories" />
                <span>{{ cat }}</span>
              </label>
            </div>
            <p class="selection-hint" style="margin-top: var(--space-2);">
              {{ recsCategories.length === 0 ? '未指定：將分析全部可推薦品類' : `已選 ${recsCategories.length} 個品類` }}
            </p>
          </div>

          <div v-if="recsError" class="alert-block alert-red" style="margin-bottom: var(--space-4);">
            ❌ {{ recsError }}
          </div>
          <div class="pref-actions">
            <button class="btn btn-primary btn-lg" :disabled="recsLoading" @click="loadEfficacyRecs">
              {{ recsLoading ? '🔍 AI 分析中...' : '🔍 開始分析' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 推薦結果 -->
      <div v-if="step === 'recs-results'" class="preferences-wrap">
        <button class="btn btn-secondary btn-sm back-btn" @click="step = 'recs-concerns'">← 重新選擇</button>

        <div v-if="efficacyRecs.length === 0" class="card pref-card" style="text-align: center; padding: var(--space-8);">
          <div style="font-size: 2rem; margin-bottom: var(--space-3)">🎉</div>
          <p style="color: var(--color-text-secondary);">您的保養品成分已相當完整，當前困擾已有充分的成分支持！</p>
        </div>

        <div v-for="rec in efficacyRecs" :key="rec.issue" class="card recs-card">
          <div class="recs-card-header">
            <span class="recs-issue-badge">{{ rec.issue }}</span>
            <span class="recs-category">建議補充：{{ rec.category }}</span>
            <button class="btn-add-product" @click="goAddProduct(rec.category)">+ 去新增</button>
          </div>
          <p class="recs-reason">{{ rec.reason }}</p>
          <div class="recs-ingredients">
            <span v-for="ing in rec.suggestedIngredients" :key="ing" class="ing-chip">{{ ing }}</span>
          </div>
        </div>

        <div class="recs-back-actions">
          <button class="btn btn-ghost" @click="router.back()">← 返回排程</button>
          <button class="btn btn-secondary" @click="step = 'recs-concerns'">重新分析</button>
          <button class="btn btn-primary" @click="confirmAndReturn">✅ 加入推薦並返回排程</button>
        </div>
      </div>

      <!-- 說明區段已移除 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PRODUCT_CATEGORIES } from '~/utils/productCategories'

const router = useRouter()
const route = useRoute()

const step = ref<'recs-concerns' | 'recs-results'>('recs-concerns')

const isRecsFlow = computed(() => route.query.action === 'recs')
const targetRoutineId = computed(() => {
  const value = route.query.routineId
  return typeof value === 'string' ? value : ''
})

// 可推薦品類（排除洗臉/防曬/其他）
const recommendableCategories = PRODUCT_CATEGORIES.filter(c => c !== '洗臉產品' && c !== '防曬' && c !== '其他')

const availableIssues = ['痘痘', '粉刺', '敏感', '暗沉', '細紋', '乾燥', '出油', '黑眼圈']

// AI 成分推薦流程
const recsIssues = ref<string[]>([])
const recsCategories = ref<string[]>([])
// 是否包含個人資料中的困擾（開啟時合並 profile.issues 一起送給 AI）
const useProfileIssues = ref(true)
const efficacyRecs = ref<Array<{ issue: string; category: string; suggestedIngredients: string[]; reason: string }>>([])
const recsLoading = ref(false)
const recsError = ref('')

const loadEfficacyRecs = async () => {
  if (!targetRoutineId.value) return
  recsLoading.value = true
  recsError.value = ''
  try {
    const res = await $fetch<{ success: boolean; data: any[] }>(
      `/api/routines/${targetRoutineId.value}/efficacy-recs`,
      { method: 'POST', body: {
        targetIssues: recsIssues.value,
        targetCategories: recsCategories.value,
        useProfileIssues: useProfileIssues.value
      }}
    )
    if (res.success) efficacyRecs.value = res.data
    step.value = 'recs-results'
  } catch (e: any) {
    recsError.value = e.data?.message || e.message || '分析失敗，請稍後再試'
  } finally {
    recsLoading.value = false
  }
}

// 加入推薦並返回排程（結果寫入 sessionStorage）
const confirmAndReturn = () => {
  if (targetRoutineId.value) {
    sessionStorage.setItem(
      `efficacyRecs_${targetRoutineId.value}`,
      JSON.stringify(efficacyRecs.value)
    )
  }
  router.replace(`/routines/${targetRoutineId.value}`)
}

// 去新增產品（帶 category）
const goAddProduct = (category: string) => {
  router.push({ path: '/', query: { from: 'recs', routineId: targetRoutineId.value, category } })
}

// 錯誤提示不再使用，但保留定義防 Vue 編譯警告
const error = ref<string | null>(null)
const clearError = () => { error.value = null }

onMounted(() => {
  if (!isRecsFlow.value || !targetRoutineId.value) {
    router.replace('/beauty-plan')
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

/* AI 成分推薦結果 */
.recs-card {
  margin-bottom: var(--space-4);
  padding: var(--space-5);
}

.recs-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
}

.recs-issue-badge {
  background: var(--color-accent-light);
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-pill);
  padding: 3px 10px;
  font-size: 13px;
  font-weight: 600;
}

.recs-category {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
  flex: 1;
}

.btn-add-product {
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--color-sage);
  color: var(--color-sage);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--font-body);
  transition: background 0.15s;
}
.btn-add-product:hover { background: var(--color-sage-light, #EAF0EC); }

.recs-reason {
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.7;
  margin: 0 0 var(--space-3);
}

.recs-ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.ing-chip {
  background: var(--color-sage-light, #e8f0ed);
  color: var(--color-sage);
  border: 1px solid var(--color-sage);
  border-radius: var(--radius-pill);
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
}

.recs-back-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: space-between;
  margin-top: var(--space-4);
}

/* 結果操作列 */
.results-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);
}

/* 每張卡頭部 */
.recs-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.recs-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* 個人困擾 toggle 列 */
.toggle-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-alt);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.toggle-switch {
  position: relative;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-track {
  display: block;
  width: 40px;
  height: 22px;
  background: var(--color-border-light);
  border-radius: 99px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.toggle-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-switch input:checked ~ .toggle-track {
  background: var(--color-sage);
}

.toggle-switch input:checked ~ .toggle-track::after {
  transform: translateX(18px);
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.toggle-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* 每張推薦卡的「去新增」按鈕 */
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
}

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
