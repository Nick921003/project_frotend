<template>
  <div class="page-container">

    <!-- 頂部狀態列 -->
    <div class="status-bar">
      <span v-if="user" class="status-bar__text">
        會員模式 · 膚質：<strong>{{ selectedSkinType }}</strong>
      </span>
      <span v-else class="status-bar__text">訪客</span>

      <button v-if="!user" class="btn btn-sm btn-ghost" @click="navigateTo('/login')">
        前往登入
      </button>
    </div>

    <h2 class="page-heading">保養品成分分析</h2>

    <!-- 步驟 1：膚質 -->
    <div class="card step-card">
      <label class="form-label step-label">步驟 1 · 確認膚質</label>
      <select v-model="selectedSkinType" :disabled="!!user" class="form-input">
        <option value="oily">油性肌膚 — 容易出油、長痘</option>
        <option value="dry">乾性肌膚 — 容易緊繃、脫屑</option>
        <option value="combination">混合性肌膚 — T字油、兩頰乾</option>
        <option value="sensitive">敏感性肌膚 — 容易泛紅、刺痛</option>
        <option value="normal">中性肌膚 — 油水分泌平衡</option>
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
          📷 選擇照片（可多選）
          <input
            type="file"
            accept="image/jpeg, image/png, image/webp"
            multiple
            :disabled="isLoading"
            style="display: none;"
            @change="handleImageUpload"
          />
        </label>
        <span v-if="imageBase64Array.length > 0" class="hint-text">
          已選擇 {{ imageBase64Array.length }} 張
        </span>
      </div>

      <div v-if="imageBase64Array.length > 0" class="preview-grid">
        <div v-for="(src, idx) in imageBase64Array" :key="idx" class="preview-item">
          <img :src="src" alt="預覽" class="preview-img" />
          <button class="preview-remove" :disabled="isLoading" @click="removeImage(idx)">×</button>
        </div>
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
      {{ isLoading ? '🤖 AI 分析中...' : '開始分析成分' }}
    </button>

    <!-- 加入保養品櫃 -->
    <button
      v-if="analysisReady && user && !saveMsg"
      class="btn btn-lg action-btn action-btn--save"
      :disabled="isSaving"
      @click="saveToCabinet"
    >
      {{ isSaving ? '儲存中...' : '✅ 加入保養品櫃' }}
    </button>

    <div v-if="saveMsg" class="status-box status-success">{{ saveMsg }}</div>
    <div v-if="errorMsg" class="status-box status-error">❌ {{ errorMsg }}</div>

    <!-- 分析結果 -->
    <div v-if="result?.data?.analysis" class="results-section">
      <h3 class="section-title">分析報告</h3>

      <div
        v-if="result.data.analysis.regulatoryAlerts.length > 0"
        class="alert-block alert-red"
      >
        <h4>🔴 法規警告（限量 / 禁用成分）</h4>
        <ul>
          <li v-for="item in result.data.analysis.regulatoryAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong> —
            <span>{{ item.warning || item.limit }}</span>
          </li>
        </ul>
      </div>

      <div
        v-if="result.data.analysis.limitAlerts?.length > 0"
        class="alert-block alert-orange"
      >
        <h4>🟠 含限量成分（濃度未知，無法確認是否超標）</h4>
        <ul>
          <li v-for="item in result.data.analysis.limitAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong> — 法規限量：{{ item.limit }}
          </li>
        </ul>
      </div>

      <div
        v-if="result.data.analysis.skinTypeAlerts.length > 0"
        class="alert-block alert-yellow"
      >
        <h4>🟡 膚質地雷（針對 {{ selectedSkinType }}）</h4>
        <ul>
          <li v-for="item in result.data.analysis.skinTypeAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong> — {{ item.risk_description }}
          </li>
        </ul>
      </div>

      <div class="alert-block alert-green">
        <h4>🟢 一般成分（未觸發警報）</h4>
        <div class="safe-chips">
          <span
            v-for="name in result.data.analysis.safeList"
            :key="name"
            class="badge badge-muted"
          >{{ name }}</span>
          <span v-if="result.data.analysis.safeList.length === 0" class="hint-text">無</span>
        </div>
      </div>

      <div v-if="result.data.overallSummary" class="alert-block alert-gold">
        <h4>— AI 配方師總評</h4>
        <p style="margin: 0; line-height: 1.7;">{{ result.data.overallSummary }}</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { onMounted, ref, watchEffect } from 'vue'
import { PRODUCT_CATEGORIES, resolveProductCategory } from '~/utils/productCategories'

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

const selectedSkinType = ref('oily')
const imageBase64Array = ref([])
const isLoading = ref(false)
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

const handleImageUpload = (event) => {
  errorMsg.value = null
  const files = event.target.files
  if (!files || files.length === 0) return

  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      errorMsg.value = `「${file.name}」過大，請上傳小於 5MB 的照片。`
      continue
    }
    const reader = new FileReader()
    reader.onload = (e) => { imageBase64Array.value.push(e.target.result) }
    reader.onerror = () => { errorMsg.value = '圖片讀取失敗，請重試。' }
    reader.readAsDataURL(file)
  }
  event.target.value = ''
}

const removeImage = (idx) => {
  imageBase64Array.value.splice(idx, 1)
}

const analyzeIngredients = async () => {
  if (imageBase64Array.value.length === 0) return

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
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-5);
  font-size: 14px;
}

.status-bar__text {
  color: var(--color-text-secondary);
}

.page-heading {
  font-size: 24px;
  margin-bottom: var(--space-5);
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
  flex-wrap: wrap;
}

.upload-label {
  cursor: pointer;
}

.upload-label.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.preview-item {
  position: relative;
  display: inline-block;
}

.preview-img {
  max-height: 120px;
  border-radius: var(--radius-md);
  display: block;
  border: 1px solid var(--color-border-light);
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
  background: #6A8A70;
  border-color: #6A8A70;
}

.results-section {
  margin-top: var(--space-8);
}

.safe-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
