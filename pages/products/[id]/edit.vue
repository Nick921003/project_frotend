<template>
  <div class="page-container">
    <h1 class="page-heading">編輯保養品</h1>

    <div v-if="loading" class="status-box status-loading">⏳ 載入產品資訊中...</div>
    <div v-if="error" class="status-box status-error">❌ {{ error }}</div>

    <form v-if="!loading && product" @submit.prevent="saveProduct">
      <div class="card">
        <div class="form-group">
          <label class="form-label" for="product_name">產品名稱</label>
          <input
            id="product_name"
            v-model="product.product_name"
            type="text"
            class="form-input"
            placeholder="輸入產品名稱"
            required
          />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="product_category">分類</label>
          <select id="product_category" v-model="product.product_category" class="form-input" required>
            <option value="">請選擇分類</option>
            <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="isSaving">
          {{ isSaving ? '儲存中...' : '儲存變更' }}
        </button>
        <button type="button" class="btn btn-secondary" @click="goBack">
          取消
        </button>
        <button type="button" class="btn btn-danger" @click="deleteProduct">
          刪除產品
        </button>
      </div>
    </form>

    <!-- 使用追蹤 -->
    <div v-if="!loading && product" class="card tracking-card">
      <h2 class="section-title">使用追蹤</h2>

      <div class="form-group">
        <label class="form-label" for="opened_at">開封日期</label>
        <input
          id="opened_at"
          v-model="tracking.opened_at"
          type="date"
          class="form-input"
          @change="autoCalcExpiry"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="expires_at">預估到期日</label>
        <p class="hint-text">依類別自動推算（可手動調整）</p>
        <input
          id="expires_at"
          v-model="tracking.expires_at"
          type="date"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="estimated_finish_days">預估使用天數</label>
        <input
          id="estimated_finish_days"
          v-model.number="tracking.estimated_finish_days"
          type="number"
          min="1"
          class="form-input"
          placeholder="例如：60"
        />
        <p v-if="estimatedFinishDate" class="hint-text">預計用完日：{{ estimatedFinishDate }}</p>
      </div>

      <div class="form-group">
        <label class="form-label" for="purchase_purpose">購買目的</label>
        <textarea
          id="purchase_purpose"
          v-model="tracking.purchase_purpose"
          class="form-input form-textarea"
          placeholder="當初買來解決什麼問題？"
          rows="2"
        />
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" for="user_notes">使用筆記</label>
        <textarea
          id="user_notes"
          v-model="tracking.user_notes"
          class="form-input form-textarea"
          placeholder="使用心得、注意事項..."
          rows="3"
        />
      </div>

      <div class="form-actions" style="margin-top: var(--space-4); margin-bottom: 0;">
        <button type="button" class="btn btn-primary" :disabled="isSavingTracking" @click="saveTracking">
          {{ isSavingTracking ? '儲存中...' : '儲存追蹤資料' }}
        </button>
      </div>

      <p v-if="trackingSaveMsg" class="hint-text" style="margin-top: var(--space-2);">{{ trackingSaveMsg }}</p>
    </div>

		<!-- AI 成分分析 -->
		<div v-if="!loading && product" class="card tracking-card">
			<h2 class="section-title">AI 成分分析</h2>
			<p class="hint-text">如果分析不完整或成分辨識有誤，您可以在此處重新拍照或上傳成分照片進行 AI 重新分析。</p>
			
			<div class="form-group" style="margin-top: var(--space-4);">
				<div class="form-actions" style="margin: 0 0 var(--space-3); gap: var(--space-2);">
					<label class="btn btn-secondary btn-sm" :class="{ 'disabled': isAnalyzing }">
						選擇成分照片
						<input
							type="file"
							accept="image/*"
							:disabled="isAnalyzing"
							style="display: none;"
							@change="handleImageUpload"
						/>
					</label>
					<button
						class="btn btn-secondary btn-sm"
						:disabled="isAnalyzing"
						type="button"
						@click="useSampleImage"
					>
						範例圖片
					</button>
				</div>

				<!-- 選擇照片後顯示預覽及分析按鈕 -->
				<div v-if="selectedImageBase64" class="preview-box">
					<p class="hint-text" style="margin-bottom: var(--space-2);">已載入照片，請確認後開始進行 AI 分析</p>
					<img :src="selectedImageBase64" alt="成分預覽" class="preview-thumbnail" />
					<div class="form-actions" style="margin-top: var(--space-3); margin-bottom: 0;">
						<button
							type="button"
							class="btn btn-primary"
							:disabled="isAnalyzing"
							@click="analyzeAndSave"
						>
							{{ isAnalyzing ? 'AI 分析中...' : '開始分析成分' }}
						</button>
						<button
							type="button"
							class="btn btn-secondary"
							:disabled="isAnalyzing"
							@click="selectedImageBase64 = ''"
						>
							取消
						</button>
					</div>
				</div>

				<p v-if="analysisError" class="hint-text" style="color: var(--color-red); margin-top: var(--space-2);">{{ analysisError }}</p>
				<p v-if="analysisSuccessMsg" class="hint-text" style="color: var(--color-sage); margin-top: var(--space-2);">{{ analysisSuccessMsg }}</p>
			</div>
		</div>

		<!-- AI 分析結果（唯讀） -->
		<div v-if="product?.analysis_result?.data?.analysis" class="card analysis-card">
			<h2 class="section-title" style="font-size: 18px; border-bottom: 1px solid var(--color-border-light); padding-bottom: var(--space-4);">AI 分析結果</h2>

			<div v-if="product.overview" class="alert-block alert-gold">
				<h4>— AI 配方師總評</h4>
				<p style="margin: 0;">{{ product.overview }}</p>
			</div>

			<div v-if="product.analysis_result.data.analysis.regulatoryAlerts?.length > 0" class="alert-block alert-red">
				<h4>法規警告成分</h4>
				<ul>
					<li v-for="item in product.analysis_result.data.analysis.regulatoryAlerts" :key="item.inci_name">
						<strong>{{ item.inci_name }}</strong>
						<span v-if="item.source === 'TFDA'" class="badge badge-red" style="margin: 0 var(--space-2); font-size: 11px;">TFDA</span>
						{{ item.warning }}
						<span v-if="item.limit" style="color: var(--color-text-muted);">（限量：{{ item.limit }}）</span>
					</li>
				</ul>
			</div>

			<div v-if="product.analysis_result.data.analysis.limitAlerts?.length > 0" class="alert-block alert-orange">
				<h4>含限量成分（濃度未知）</h4>
				<ul>
					<li v-for="item in product.analysis_result.data.analysis.limitAlerts" :key="item.inci_name">
						<strong>{{ item.inci_name }}</strong>
						<span v-if="item.source === 'TFDA'" class="badge badge-amber" style="margin: 0 var(--space-2); font-size: 11px;">TFDA</span>
						<span v-if="item.limit" style="color: var(--color-text-muted);">法規限量：{{ item.limit }}</span>
					</li>
				</ul>
			</div>

			<div v-if="product.analysis_result.data.analysis.skinTypeAlerts?.length > 0" class="alert-block alert-yellow">
				<h4>膚質注意成分</h4>
				<ul>
					<li v-for="item in product.analysis_result.data.analysis.skinTypeAlerts" :key="item.inci_name">
						<strong>{{ item.inci_name }}</strong> {{ item.risk_description }}
					</li>
				</ul>
			</div>

			<div v-if="product.analysis_result.data.analysis.safeList?.length > 0" class="alert-block alert-green" style="margin-bottom: 0;">
				<h4>其他成分（無法規標記）</h4>
				<p class="safe-list">{{ product.analysis_result.data.analysis.safeList.map((i: any) => typeof i === 'string' ? i : i.inci_name).join('、') }}</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { CabinetProduct } from '~/types/routine'
import { PRODUCT_CATEGORIES, normalizeProductCategory } from '~/utils/productCategories'

const router = useRouter()
const route = useRoute()

const product = ref<Partial<CabinetProduct> | null>(null)
const loading = ref(true)
const isSaving = ref(false)
const isSavingTracking = ref(false)
const error = ref<string | null>(null)
const trackingSaveMsg = ref('')
const categoryOptions = PRODUCT_CATEGORIES

const productId = route.params.id as string

// 重新分析狀態變數
const selectedImageBase64 = ref('')
const isAnalyzing = ref(false)
const analysisError = ref('')
const analysisSuccessMsg = ref('')

const tracking = reactive({
  opened_at: '' as string,
  expires_at: '' as string,
  estimated_finish_days: null as number | null,
  purchase_purpose: '' as string,
  user_notes: '' as string
})

// PAO 開封後保存期限（月）對應各類別
const PAO_MONTHS: Record<string, number> = {
  '精華液': 6, '眼霜': 6, '去角質': 6,
  '乳液': 12, '乳霜': 12, '面霜': 12, '防曬': 12
}

// 依開封日 + 類別自動推算到期日
const autoCalcExpiry = () => {
  if (!tracking.opened_at || !product.value?.product_category) return;
  const months = PAO_MONTHS[product.value.product_category] ?? 12;
  const d = new Date(tracking.opened_at);
  d.setMonth(d.getMonth() + months);
  tracking.expires_at = d.toISOString().slice(0, 10);
};

// 計算預計用完日
const estimatedFinishDate = computed(() => {
  if (!tracking.opened_at || !tracking.estimated_finish_days) return ''
  const d = new Date(tracking.opened_at)
  d.setDate(d.getDate() + tracking.estimated_finish_days)
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
})

const fetchProduct = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await $fetch<{ success: boolean; data: CabinetProduct }>(`/api/cabinet/${productId}`)
    if (response.success) {
      product.value = {
        ...response.data,
        product_category: normalizeProductCategory(response.data.product_category)
      }
      // 初始化追蹤欄位
      tracking.opened_at = response.data.opened_at
        ? String(response.data.opened_at).slice(0, 10)
        : ''
      tracking.expires_at = response.data.expires_at
        ? String(response.data.expires_at).slice(0, 10)
        : ''
      tracking.estimated_finish_days = response.data.estimated_finish_days ?? null
      tracking.purchase_purpose = response.data.purchase_purpose ?? ''
      tracking.user_notes = response.data.user_notes ?? ''
    } else {
      error.value = '無法載入產品資訊'
    }
  } catch (err: any) {
    console.error('Fetch product error:', err)
    error.value = err.data?.message || '載入產品失敗'
  } finally {
    loading.value = false
  }
}

const saveProduct = async () => {
  if (!product.value || !productId) return

  isSaving.value = true
  error.value = null

  try {
    const response = await $fetch<{ success: boolean; message?: string }>(`/api/cabinet/${productId}`, {
      method: 'PUT',
      body: {
        product_name: product.value.product_name,
        product_category: normalizeProductCategory(product.value.product_category)
      }
    })

    if (response.success) {
      alert('產品已更新')
      router.push('/beauty-plan')
    } else {
      error.value = response.message || '保存失敗'
    }
  } catch (err: any) {
    console.error('Save product error:', err)
    error.value = err.data?.message || '保存失敗'
  } finally {
    isSaving.value = false
  }
}

const deleteProduct = async () => {
  if (!productId) return

  const confirmed = confirm('確定要刪除此產品嗎？此操作無法撤銷。')
  if (!confirmed) return

  isSaving.value = true
  error.value = null

  try {
    await $fetch(`/api/cabinet/${productId}`, {
      method: 'DELETE'
    })

    alert('產品已刪除')
    router.push('/beauty-plan')
  } catch (err: any) {
    console.error('Delete product error:', err)
    error.value = err.data?.message || '刪除失敗'
  } finally {
    isSaving.value = false
  }
}

const saveTracking = async () => {
  if (!productId) return

  isSavingTracking.value = true
  trackingSaveMsg.value = ''
  error.value = null

  try {
    await $fetch(`/api/cabinet/${productId}`, {
      method: 'PUT',
      body: {
        opened_at: tracking.opened_at || null,
        expires_at: tracking.expires_at || null,
        estimated_finish_days: tracking.estimated_finish_days,
        purchase_purpose: tracking.purchase_purpose || null,
        user_notes: tracking.user_notes || null
      }
    })
    trackingSaveMsg.value = '追蹤資料已儲存'
    setTimeout(() => { trackingSaveMsg.value = '' }, 3000)
  } catch (err: any) {
    console.error('Save tracking error:', err)
    error.value = err.data?.message || '儲存追蹤資料失敗'
  } finally {
    isSavingTracking.value = false
  }
}

// 處理選擇照片並轉為 base64 供預覽
const handleImageUpload = (event: Event) => {
	const target = event.target as HTMLInputElement
	const file = target.files?.[0]
	if (!file) return

	const reader = new FileReader()
	reader.onloadend = () => {
		selectedImageBase64.value = reader.result as string
	}
	reader.readAsDataURL(file)
}

// 讀取 public 下的範例圖片進行無感載入
const useSampleImage = async () => {
	isAnalyzing.value = true
	analysisError.value = ''
	try {
		const res = await fetch('/sample-ingredients.jpg')
		const blob = await res.blob()
		const reader = new FileReader()
		reader.onloadend = () => {
			selectedImageBase64.value = reader.result as string
			isAnalyzing.value = false
		}
		reader.readAsDataURL(blob)
	} catch (err: any) {
		analysisError.value = '載入範例圖片失敗: ' + err.message
		isAnalyzing.value = false
	}
}

// 開始 AI 分析成分，並將結果儲存回此產品櫃記錄中
const analyzeAndSave = async () => {
	if (!selectedImageBase64.value) return
	isAnalyzing.value = true
	analysisError.value = ''
	analysisSuccessMsg.value = ''

	try {
		// 1. 呼叫 Gemini 分析 API
		const res = await $fetch<any>('/api/analyze', {
			method: 'POST',
			body: {
				imageBase64Array: [selectedImageBase64.value],
				skinType: 'normal'
			}
		})

		if (!res || !res.data?.analysis) {
			throw new Error('AI 分析失敗，請更換較清晰的成分照片')
		}

		// 2. 將分析所得的數據寫回 user_cabinet 產品欄位中
		const updateRes = await $fetch<any>(`/api/cabinet/${productId}`, {
			method: 'PUT',
			body: {
				analysis_result: res,
				overview: res.data.overallSummary || '',
				raw_ingredients: res.data.rawIngredients || ''
			}
		})

		if (updateRes.success) {
			analysisSuccessMsg.value = 'AI 重新分析與保存成功！'
			selectedImageBase64.value = ''
			// 3. 刷新本機資料以重新繪製最新的唯讀結果
			await fetchProduct()
			setTimeout(() => { analysisSuccessMsg.value = '' }, 3000)
		} else {
			throw new Error(updateRes.message || '更新保養品分析失敗')
		}
	} catch (err: any) {
		analysisError.value = err.message || 'AI 分析發生錯誤'
	} finally {
		isAnalyzing.value = false
	}
}

const goBack = () => {
	router.push('/beauty-plan')
}

onMounted(() => {
	fetchProduct()
})
</script>

<style scoped>
.page-heading {
  font-size: 24px;
  margin-bottom: var(--space-6);
}

.form-actions {
  display: flex;
  gap: var(--space-3);
  margin: var(--space-5) 0;
  flex-wrap: wrap;
}

.form-actions .btn {
  flex: 1;
  min-width: 80px;
}

.tracking-card {
  margin-top: var(--space-5);
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.hint-text {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: var(--space-1) 0 0;
}

.analysis-card {
  margin-top: var(--space-5);
}

.safe-list {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

/* 重新分析預覽框與縮圖 */
.preview-box {
	background: var(--color-surface-alt);
	padding: var(--space-4);
	border-radius: var(--radius-md);
	border: 1px dashed var(--color-border);
	margin-top: var(--space-3);
}

.preview-thumbnail {
	max-width: 150px;
	max-height: 150px;
	border-radius: var(--radius-md);
	border: 1px solid var(--color-border);
	margin-top: var(--space-2);
}
</style>
