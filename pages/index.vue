<template>
  <div class="page-container--wide">
    <div class="analyze-layout">
      <!-- 左欄：操作區（固定不滾動） -->
      <div class="analyze-left">

        <div v-if="!user" class="heading-row">
          <button class="btn btn-sm btn-ghost" @click="navigateTo('/login')">前往登入</button>
        </div>

        <!-- 步驟 1：膚質 -->
        <div class="card step-card">
          <label class="form-label step-label">步驟 1 · 確認膚質</label>
          <select v-model="selectedSkinType" :disabled="!!user" class="form-input">
            <option value="oily">油性肌 — 容易出油、長痘</option>
            <option value="dry">乾性肌 — 容易緊繃、脫屑</option>
            <option value="combination_oily">混合偏油 — T字出油、兩頰中性</option>
            <option value="combination_dry">混合偏乾 — T字中性、兩頰偏乾</option>
            <option value="sensitive">敏感肌 — 容易泛紅、刺痛</option>
            <option value="combination">混合性肌膚（舊版）</option>
            <option value="normal">中性肌膚（舊版）</option>
          </select>
          <p v-if="user" class="hint-text">已自動套用您的會員膚質設定</p>
        </div>

        <!-- 步驟 2：上傳 -->
        <div class="card step-card upload-card">
          <label class="form-label step-label">步驟 2 · 上傳成分表照片</label>

          <div class="upload-fields">
            <input
              v-model="productName"
              type="text"
              placeholder="產品名稱（可不填，系統會自動命名）"
              :disabled="isLoading"
              class="form-input"
            />
            <select v-model="productCategory" :disabled="isLoading" class="form-input">
              <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <div class="upload-row">
            <label class="btn btn-secondary btn-sm upload-label" :class="{ 'disabled': isLoading }">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              選擇照片（可多選）
              <input
                type="file"
                accept="image/*"
                multiple
                :disabled="isLoading"
                style="display: none;"
                @change="handleImageUpload"
              />
            </label>
            <button
              class="btn btn-secondary btn-sm drive-btn-desktop"
              :disabled="isLoading"
              type="button"
              @click="handleDrivePick"
            >
              從 Google Drive 選取
            </button>
          </div>

          <p v-if="fromRoutine" class="hint-text hint-text--accent">
            來自排程頁：分析並加入保養品櫃後，將自動返回原排程頁。
          </p>
        </div>

        <!-- 送出按鈕 -->
        <button
          class="btn btn-primary btn-lg action-btn"
          :disabled="imageBase64Array.length === 0 || isLoading"
          @click="analyzeIngredients"
        >
          {{ isLoading ? 'AI 分析中...' : '開始分析成分' }}
        </button>

        <!-- 加入保養品櫃 -->
        <button
          v-if="analysisReady && user && !saveMsg"
          class="btn btn-lg action-btn action-btn--save"
          :disabled="isSaving"
          @click="saveToCabinet"
        >
          {{ isSaving ? '儲存中...' : '加入保養品櫃' }}
        </button>

        <div v-if="saveMsg" class="status-box status-success">{{ saveMsg }}</div>
        <div v-if="errorMsg" class="status-box status-error">❌ {{ errorMsg }}</div>

      </div>

      <!-- 右欄：結果區（可滾動） -->
      <div class="analyze-right">

        <!-- 狀態 A：尚未選圖 -->
        <div v-if="!result?.data?.analysis && imageBase64Array.length === 0 && !isUploading" class="result-placeholder">
          <p>上傳成分表照片後，分析結果會顯示在這裡</p>
        </div>

        <!-- 狀態 B：已選圖 / 上傳中，等待分析 -->
        <div v-else-if="!result?.data?.analysis && (imageBase64Array.length > 0 || isUploading)" class="preview-panel">
          <p class="preview-count-label">
            <template v-if="isUploading">
              <span class="upload-spinner"></span>
              上傳中，請稍候...
            </template>
            <template v-else>已選擇 {{ imageBase64Array.length }} 張，確認無誤後點擊「開始分析成分」</template>
          </p>
          <div class="preview-grid">
            <div v-for="(src, idx) in imageBase64Array" :key="idx" class="preview-item">
              <div
                v-if="src.startsWith('data:image/heic') || src.startsWith('data:image/heif')"
                class="preview-heic"
              >HEIC</div>
              <img v-else :src="src" alt="預覽" class="preview-img" @click="previewSrc = src" />
              <button class="preview-remove" :disabled="isLoading" @click="removeImage(idx)">×</button>
              <span class="preview-size-badge">{{ Math.round(src.length * 0.75 / 1024) }} KB</span>
            </div>
          </div>
        </div>

        <!-- 狀態 C：分析結果 -->
        <div v-else class="results-section">
          <!-- 膚況未設定時的引導卡片 -->
          <div v-if="showProfileSetupPrompt" class="profile-prompt-card">
            <div class="profile-prompt-card__text">
              <strong>讓這次分析更精準</strong>
              <p>設定你的膚質與肌膚困擾，AI 下次能提供更個人化的成分建議</p>
            </div>
            <button
              class="btn btn-sm btn-secondary"
              @click="navigateTo('/profile-setup')"
            >
              前往設定
            </button>
          </div>

          <div v-if="result.data.detectedProductName" class="detected-product-name">
            <span class="detected-label">辨識產品</span>
            <span>{{ result.data.detectedProductName }}</span>
          </div>

          <!-- AI 總評（品名下方） -->
          <div v-if="result.data.overallSummary" class="result-summary result-summary--top">
            <div class="result-summary__label">AI 配方師總評</div>
            <p class="result-summary__body">{{ result.data.overallSummary }}</p>
          </div>

          <!-- 法規警告 -->
          <div v-if="result.data.analysis.regulatoryAlerts.length > 0" class="result-section">
            <div class="result-section__header">
              <span class="result-dot result-dot--red"></span>
              <span class="result-label">法規警告（限量 / 禁用成分）</span>
              <span class="result-count">{{ result.data.analysis.regulatoryAlerts.length }}</span>
            </div>
            <div class="result-rows">
              <div v-for="item in result.data.analysis.regulatoryAlerts" :key="item.inci_name" class="result-row">
                <span class="result-inci">{{ item.inci_name }}</span>
                <span class="result-note">{{ item.warning || item.limit }}</span>
              </div>
            </div>
          </div>

          <!-- 含限量成分 -->
          <div v-if="result.data.analysis.limitAlerts?.length > 0" class="result-section">
            <div class="result-section__header">
              <span class="result-dot result-dot--orange"></span>
              <span class="result-label">含限量成分（濃度未知，無法確認是否超標）</span>
              <span class="result-count">{{ result.data.analysis.limitAlerts.length }}</span>
            </div>
            <div class="result-rows">
              <div v-for="item in result.data.analysis.limitAlerts" :key="item.inci_name" class="result-row">
                <span class="result-inci">{{ item.inci_name }}</span>
                <span class="result-note">法規限量：{{ item.limit }}</span>
              </div>
            </div>
          </div>

          <!-- 膚質地雷 -->
          <div v-if="!suppressWarnings && result.data.analysis.skinTypeAlerts.length > 0" class="result-section">
            <div class="result-section__header">
              <span class="result-dot result-dot--amber"></span>
              <span class="result-label">膚質地雷（針對 {{ selectedSkinType }}）</span>
              <span class="result-count">{{ result.data.analysis.skinTypeAlerts.length }}</span>
            </div>
            <div class="result-rows">
              <div v-for="item in result.data.analysis.skinTypeAlerts" :key="item.inci_name" class="result-row">
                <span class="result-inci">{{ item.inci_name }}</span>
                <span class="result-note">{{ item.risk_description }}</span>
              </div>
            </div>
          </div>

          <!-- 一般成分（折疊） -->
          <div class="result-section">
            <div class="result-section__header">
              <span class="result-dot result-dot--green"></span>
              <span class="result-label">一般成分（未觸發警報）</span>
              <span class="result-count">{{ result.data.analysis.safeList.length }}</span>
            </div>
            <div class="safe-chips">
              <span
                v-for="item in (showAllSafe ? result.data.analysis.safeList : result.data.analysis.safeList.slice(0, 12))"
                :key="typeof item === 'string' ? item : item.inci_name"
                class="safe-chip"
                :title="typeof item === 'object' && item.function_summary ? item.function_summary : undefined"
              >{{ typeof item === 'string' ? item : item.inci_name }}</span>
              <span v-if="result.data.analysis.safeList.length === 0" class="hint-text">無</span>
            </div>
            <button
              v-if="result.data.analysis.safeList.length > 12"
              class="safe-toggle"
              @click="showAllSafe = !showAllSafe"
            >
              {{ showAllSafe ? '收起' : `展開全部 (${result.data.analysis.safeList.length})` }}
            </button>
          </div>
        </div>

        <!-- 圖片放大 lightbox -->
        <div v-if="previewSrc" class="lightbox" @click="previewSrc = null">
          <img :src="previewSrc" class="lightbox-img" @click.stop />
          <button class="lightbox-close" @click="previewSrc = null">×</button>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watchEffect, computed, nextTick } from 'vue'
import { PRODUCT_CATEGORIES, resolveProductCategory } from '~/utils/productCategories'
import { useUserProfile } from '~/stores/useUserProfile'

const user = useSupabaseUser()

// 進階模式：從 store 讀取，控制是否隱藏膚質地雷警告
const userProfileStore = useUserProfile()
const suppressWarnings = computed(() => userProfileStore.profile?.suppress_safety_warnings === true)

// 分析完成後，若登入用戶尚未設定膚況，提示前往設定
const showProfileSetupPrompt = computed(() =>
  !!user.value &&
  analysisReady.value &&
  !userProfileStore.loading &&
  (!userProfileStore.profile || !userProfileStore.skinConcernsArray.length)
)

// 若登入後 store 尚未載入 profile，則自動拉取（避免首次進入分析頁時警告仍顯示）
watchEffect(() => {
  // 只在 client 端執行：SSR 時 $fetch 不帶 cookie，fetchUserProfile 會回 401
  if (import.meta.client && user.value && !userProfileStore.profile && !userProfileStore.loading) {
    userProfileStore.fetchUserProfile()
  }
})
const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const selectedSkinType = ref('oily')
const imageBase64Array = ref([])
const isLoading = ref(false)
const isUploading = ref(false)
const isSaving = ref(false)
const result = ref(null)
const errorMsg = ref(null)
const saveMsg = ref('')
const analysisReady = ref(false)
const pendingAnalysisData = ref(null)
const fromRoutine = ref(false)
const returnRoutineId = ref('')
const productName = ref('')
const productCategory = ref('其他')

const categoryOptions = PRODUCT_CATEGORIES

watchEffect(async () => {
  if (user.value) {
    const userId = user.value.sub || user.value.id
    if (!userId) return

    const { data, error } = await supabase
      .from('profiles')
      .select('base_skin_type')
      .eq('id', userId)
      .single()

    if (!error && data?.base_skin_type) {
      selectedSkinType.value = data.base_skin_type
    }
  }
})

// 壓縮圖片：長邊縮到 1024px，JPEG quality 0.75，符合 Vercel 4.5MB body 限制
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1024
      let width = img.naturalWidth
      let height = img.naturalHeight
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      const result = canvas.toDataURL('image/jpeg', 0.75)
      resolve(result)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片載入失敗')) }
    img.src = url
  })
}

const isHeicFile = (file: File) => {
  return file.type === 'image/heic' || file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name)
}

const convertHeicFile = async (file: File): Promise<string> => {
  const form = new FormData()
  form.append('file', file, file.name || 'image.heic')
  const result = await $fetch<{ base64: string }>('/api/convert-heic', {
    method: 'POST',
    body: form,
  })
  return result.base64
}

const handleImageUpload = async (event) => {
  errorMsg.value = null
  const files = event.target.files
  if (!files || files.length === 0) return

  isUploading.value = true
  await nextTick() // 讓 Vue 先更新 DOM 顯示 spinner，再開始壓縮
  const errors: string[] = []
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) {
      errors.push(`「${file.name}」過大（上限 20MB）`)
      continue
    }
    try {
      let base64: string
      if (isHeicFile(file)) {
        base64 = await convertHeicFile(file)
      } else {
        base64 = await compressImage(file)
      }
      // 壓縮後 base64 超過 1.5MB → 單張已過大，拒絕
      if (base64.length > 1.5 * 1024 * 1024) {
        errors.push(`「${file.name}」壓縮後仍過大，請改用較小圖片`)
        continue
      }
      imageBase64Array.value.push(base64)
    } catch {
      errors.push(`「${file.name}」讀取失敗`)
    }
  }
  isUploading.value = false
  if (errors.length) errorMsg.value = errors.join('、') + '，請重試。'
  event.target.value = ''
}

const previewSrc = ref(null)
const showAllSafe = ref(false)

const { openPicker } = useGoogleDrivePicker()

const handleDrivePick = () => {
  openPicker(
    (base64) => { imageBase64Array.value.push(base64) },
    (msg) => { errorMsg.value = msg },
    () => { isUploading.value = true },
    () => { isUploading.value = false },
    user.value?.email || undefined
  )
}

const removeImage = (idx) => {
  imageBase64Array.value.splice(idx, 1)
}

const analyzeIngredients = async () => {
  if (imageBase64Array.value.length === 0) return

  // 送出前檢查總 base64 大小，避免超過 Vercel 4.5MB body 限制
  const totalBytes = imageBase64Array.value.reduce((sum, b64) => sum + b64.length, 0)
  if (totalBytes > 3.5 * 1024 * 1024) {
    errorMsg.value = '圖片總大小過大，請減少張數或更換較小的圖片'
    return
  }

  isLoading.value = true
  result.value = null
  errorMsg.value = null
  saveMsg.value = ''
  analysisReady.value = false
  pendingAnalysisData.value = null

  try {
    const res = await $fetch('/api/analyze', {
      method: 'POST',
      body: { imageBase64Array: imageBase64Array.value, skinType: selectedSkinType.value },
      timeout: 60000
    })

    result.value = res
    analysisReady.value = true
    pendingAnalysisData.value = res

    if (!productName.value.trim() && res.data?.detectedProductName) {
      productName.value = res.data.detectedProductName
    }

    if (!user.value) {
      saveMsg.value = '⚠️ 已分析完成。請先登入後再加入保養品櫃。'
    }
  } catch (error) {
    errorMsg.value = error.data?.statusMessage || error.message || '發生未知的錯誤'
  } finally {
    isLoading.value = false
  }
}

const saveToCabinet = async () => {
  if (!pendingAnalysisData.value || !user.value) return

  isSaving.value = true
  const res = pendingAnalysisData.value

  try {
    const finalName = productName.value?.trim() || `未命名產品 ${new Date().toLocaleDateString('zh-TW')}`
    const finalCategory = productCategory.value || '其他'
    const rawIngredients = JSON.stringify(res?.data?.rawAiOutput || [])

    await $fetch('/api/cabinet/save', {
      method: 'POST',
      body: {
        productName: finalName,
        productCategory: finalCategory,
        rawIngredients,
        analysisResult: res?.data || null,
        overallSummary: res?.data?.overallSummary || null
      },
      timeout: 30000
    })

    saveMsg.value = '✅ 已加入保養品櫃'
    analysisReady.value = false

    if (fromRoutine.value && returnRoutineId.value) {
      setTimeout(() => {
        router.push({ path: `/routines/${returnRoutineId.value}`, query: { cabinetUpdated: '1' } })
      }, 600)
    }
  } catch (error) {
    errorMsg.value = error.data?.statusMessage || error.message || '儲存失敗，請重試'
  } finally {
    isSaving.value = false
  }
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  result.value = null
}

onMounted(() => {
  const from = typeof route.query.from === 'string' ? route.query.from : ''
  const routineId = typeof route.query.routineId === 'string' ? route.query.routineId : ''
  const categoryHint = typeof route.query.category === 'string' ? route.query.category : ''

  fromRoutine.value = from === 'routine' && !!routineId
  returnRoutineId.value = routineId

  if (categoryHint) {
    const resolvedHint = resolveProductCategory(categoryHint)
    if (resolvedHint) {
      productCategory.value = resolvedHint
    } else {
      productName.value = categoryHint
    }
  }
})
</script>

<style scoped>
/* 雙欄佈局 */
.analyze-layout {
  display: grid;
  grid-template-columns: 460px 1fr;
  gap: var(--space-6);
  align-items: start;
}

.analyze-left {
  position: sticky;
  top: var(--space-4);
}

.analyze-right {
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.result-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--color-warm-dark);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  font-size: 14px;
  text-align: center;
  padding: var(--space-6);
}

/* 手機版退回單欄 */
@media (max-width: 900px) {
  .analyze-layout {
    grid-template-columns: 1fr;
  }
  .analyze-left {
    position: static;
  }
  .upload-row {
    flex-wrap: wrap;
  }
}

.heading-row {
  margin-bottom: var(--space-4);
}


.step-card {
  margin-bottom: var(--space-4);
}

.step-label {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.hint-text {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: var(--space-2);
  margin-bottom: 0;
}

.hint-text--accent {
  color: var(--color-accent);
}

.upload-card {
  border: 2px dashed var(--color-border);
  background: var(--color-surface-alt);
}

.upload-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.upload-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: nowrap;
}

.upload-label {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  flex: 1;
  justify-content: center;
}

.upload-row .btn {
  flex: 1;
  justify-content: center;
}

.upload-label.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.preview-panel {
  padding: var(--space-5);
  background: var(--color-surface-alt);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  min-height: 300px;
  flex: 1;
}

.preview-count-label {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.preview-item {
  position: relative;
  display: inline-block;
}

.preview-img {
  max-height: 260px;
  border-radius: var(--radius-md);
  display: block;
  border: 1px solid var(--color-border-light);
  cursor: zoom-in;
  object-fit: cover;
}

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: var(--radius-md);
  object-fit: contain;
}

.lightbox-close {
  position: fixed;
  top: 16px;
  right: 20px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

.preview-heic {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  font-size: 11px;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.preview-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(58, 50, 45, 0.7);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-size-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  pointer-events: none;
}

.upload-spinner {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--color-text-muted);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: middle;
  margin-right: 6px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.action-btn {
  width: 100%;
  margin-bottom: var(--space-3);
}

.action-btn--save {
  background: var(--color-sage);
  border-color: var(--color-sage);
  color: #fff;
}

.action-btn--save:hover:not(:disabled) {
  background: #7A9870;
  border-color: #7A9870;
}

.results-section {}

.profile-prompt-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-accent-light);
  border: 1px solid var(--color-warm-dark);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.profile-prompt-card__text strong {
  font-size: 14px;
  color: var(--color-accent);
  display: block;
  margin-bottom: 2px;
}

.profile-prompt-card__text p {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.detected-product-name {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: 15px;
}

.detected-label {
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

/* ── 診斷報告式結果卡 ── */
.result-section {
  padding: var(--space-5) 0;
  border-top: 1px solid var(--color-border-light);
}

.result-section:first-of-type {
  border-top: none;
  padding-top: var(--space-3);
}

.result-section__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.result-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.result-dot--red    { background: var(--color-red); }
.result-dot--orange { background: var(--color-amber); }
.result-dot--amber  { background: #D4AA80; }
.result-dot--green  { background: var(--color-sage); }

.result-label {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--color-text-secondary);
  flex: 1;
}

.result-count {
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  border-radius: var(--radius-pill);
  padding: 2px 9px;
  letter-spacing: 0.02em;
}

.result-rows {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.result-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-light);
  font-size: 14px;
}

.result-row:last-child { border-bottom: none; }

.result-inci {
  font-weight: 500;
  color: var(--color-text-primary);
  min-width: 200px;
}

.result-note {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.result-summary {
  padding: var(--space-5) 0 0;
  border-top: 1px solid var(--color-border-light);
  margin-top: var(--space-2);
}

.result-summary--top {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.result-summary__label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
}

.result-summary__body {
  font-size: 15px;
  line-height: 1.8;
  color: var(--color-text-secondary);
  margin: 0;
}

.safe-toggle {
  margin-top: var(--space-3);
  background: none;
  border: none;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  letter-spacing: 0.02em;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.safe-toggle:hover {
  color: var(--color-accent);
}

/* 一般成分 chips */
.safe-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.safe-chip {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: default;
  transition: background 0.15s;
}

.safe-chip:hover {
  background: var(--color-border-light);
}

/* ─── Mobile ─────────────────────────────────────────────── */
/* 觸控裝置（手機、平板）隱藏 Drive 按鈕，原生選擇器已內建雲端硬碟 */
@media (pointer: coarse) {
  .drive-btn-desktop {
    display: none;
  }
}

@media (max-width: 640px) {
  /* 成分列改垂直堆疊，避免 min-width overflow */
  .result-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .result-inci {
    min-width: unset;
  }
  /* 膚況提示卡改垂直 */
  .profile-prompt-card {
    flex-direction: column;
    align-items: flex-start;
  }
  /* result-label 在極窄螢幕縮字 */
  .result-label {
    font-size: 12px;
  }
}
</style>
