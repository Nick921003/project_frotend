<template>
	<div class="page-container" style="max-width: 1200px;">
		<h1 class="page-heading">編輯保養品</h1>

		<div v-if="loading" class="status-box status-loading">載入產品資訊中...</div>
		<div v-if="error" class="status-box status-error">{{ error }}</div>

		<form v-if="!loading && product" @submit.prevent="saveProduct">
			<div class="edit-grid">
				<!-- 左欄：基本品名、成分與 AI 分析結果 -->
				<div class="edit-col-left">
					<!-- 產品名稱與成分 -->
					<div class="card">
						<h2 class="section-title">基本與成分資訊</h2>
						
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
							<label class="form-label" for="raw_ingredients">成分表文字</label>
							<textarea
								id="raw_ingredients"
								v-model="rawIngredientsText"
								class="form-input form-textarea"
								placeholder="請輸入成分，以逗號或換行分隔（例如：水, 甘油, 丁二醇）"
								rows="8"
							/>
						</div>

						<div class="form-group" style="margin-bottom: 0; border-top: 1px dashed var(--color-border); padding-top: var(--space-4); margin-top: var(--space-4);">
							<label class="form-label">AI 重新分析</label>
							<p class="hint-text">如果分析不完整或成分有誤，您可在此編輯文字後分析，或重新上傳照片。</p>
							
							<div class="form-actions" style="margin: var(--space-3) 0 0; gap: var(--space-2);">
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
									@click="analyzeCurrentData"
								>
									以目前資料分析
								</button>
							</div>

							<!-- 選擇照片後顯示預覽及分析按鈕 -->
							<div v-if="selectedImageBase64" class="preview-box">
								<p class="hint-text" style="margin-bottom: var(--space-2);">已載入照片，請確認後開始進行 AI 分析</p>
								<img :src="selectedImageBase64" alt="成分預覽" class="preview-thumbnail" />
								<div class="form-actions" style="margin-top: var(--space-3); margin-bottom: 0;">
									<button
										type="button"
										class="btn btn-primary btn-sm"
										:disabled="isAnalyzing"
										@click="analyzeAndSave"
									>
										{{ isAnalyzing ? 'AI 分析中...' : '開始分析成分照片' }}
									</button>
									<button
										type="button"
										class="btn btn-secondary btn-sm"
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

					<!-- 產品配方分析報告（替代 AI 分析結果） -->
					<div v-if="analysisData" class="card analysis-report-card" style="margin-top: var(--space-5);">
						<div class="report-header">
							<h2 class="report-title">配方分析與法規檢驗報告</h2>
							<p class="report-subtitle">根據成分表與衛生福利部食品藥物管理署（TFDA）化粧品法規進行科學分析</p>
						</div>

						<!-- 配方總評 -->
						<div v-if="product.overview" class="report-section overview-section">
							<h3 class="section-subtitle-small">配方整體評價</h3>
							<p class="overview-text">{{ product.overview }}</p>
						</div>

						<!-- 限制與警告成分 -->
						<div v-if="analysisData.regulatoryAlerts?.length > 0 || analysisData.limitAlerts?.length > 0" class="report-section alert-section">
							<h3 class="section-subtitle-small">法規與限量標記成分</h3>
							<div class="report-list-container">
								<div v-for="item in analysisData.regulatoryAlerts" :key="item.inci_name" class="report-item item-critical">
									<div class="item-meta">
										<span class="report-badge badge-critical">禁用或警告成分</span>
										<strong class="item-name">{{ item.inci_name }}</strong>
										<span v-if="item.source === 'TFDA'" class="report-badge badge-tfda">TFDA</span>
									</div>
									<p class="item-desc">{{ item.warning }} <span v-if="item.limit" class="item-limit">（法規限量：{{ item.limit }}）</span></p>
								</div>

								<div v-for="item in analysisData.limitAlerts" :key="item.inci_name" class="report-item item-warning">
									<div class="item-meta">
										<span class="report-badge badge-warning">限用成分（濃度未知，無法確認是否超標）</span>
										<strong class="item-name">{{ item.inci_name }}</strong>
										<span v-if="item.source === 'TFDA'" class="report-badge badge-tfda">TFDA</span>
									</div>
									<p class="item-desc">本成分有限量規定但濃度未知，無法確認是否超標。<span v-if="item.limit" class="item-limit">（法規限量：{{ item.limit }}）</span></p>
								</div>
							</div>
						</div>

						<!-- 膚質適配提醒 -->
						<div v-if="analysisData.skinTypeAlerts?.length > 0" class="report-section skin-section">
							<h3 class="section-subtitle-small">膚質特異性提醒</h3>
							<div class="report-list-container">
								<div v-for="item in analysisData.skinTypeAlerts" :key="item.inci_name" class="report-item item-info">
									<div class="item-meta">
										<span class="report-badge badge-info">膚質注意</span>
										<strong class="item-name">{{ item.inci_name }}</strong>
									</div>
									<p class="item-desc">{{ item.risk_description }}</p>
								</div>
							</div>
						</div>


					</div>
				</div>

				<!-- 右欄：類別、使用追蹤與操作按鈕 -->
				<div class="edit-col-right">
					<!-- 產品分類與使用追蹤 -->
					<div class="card">
						<h2 class="section-title">使用追蹤</h2>

						<div class="form-group">
							<label class="form-label" for="product_category">分類</label>
							<select id="product_category" v-model="product.product_category" class="form-input" required @change="autoCalcExpiry">
								<option value="">請選擇分類</option>
								<option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
							</select>
						</div>

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
					</div>

					<!-- 操作動作 -->
					<div class="card" style="margin-top: var(--space-5);">
						<div class="form-actions" style="margin: 0; gap: var(--space-3); flex-direction: column;">
							<button type="submit" class="btn btn-primary" style="width: 100%;" :disabled="isSaving">
								{{ isSaving ? '儲存中...' : '儲存變更' }}
							</button>
							<div style="display: flex; gap: var(--space-3); width: 100%;">
								<button type="button" class="btn btn-secondary" style="flex: 1;" @click="goBack">
									取消
								</button>
								<button type="button" class="btn btn-danger" style="flex: 1;" @click="deleteProduct">
									刪除產品
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</form>
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
const error = ref<string | null>(null)
const categoryOptions = PRODUCT_CATEGORIES

const productId = route.params.id as string

// 重新分析狀態變數
const selectedImageBase64 = ref('')
const isAnalyzing = ref(false)
const analysisError = ref('')
const analysisSuccessMsg = ref('')
const rawIngredientsText = ref('')

const analysisData = computed(() => {
	if (!product.value || !product.value.analysis_result) return null
	const res = product.value.analysis_result
	// 1. 如果 res 含有 analysis
	if (res.analysis) return res.analysis
	// 2. 如果 res.data 含有 analysis
	if (res.data?.analysis) return res.data.analysis
	// 3. 如果 res 本身就平鋪了 alerts (比如 res.regulatoryAlerts 存在)
	if (res.regulatoryAlerts || res.limitAlerts) return res
	// 4. 如果 res.data 本身平鋪了 alerts (比如 res.data.regulatoryAlerts 存在)
	if (res.data?.regulatoryAlerts || res.data?.limitAlerts) return res.data
	return null
})

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

const parseIngredientsToText = (raw: any): string => {
	if (!raw) return '';
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				return parsed.join(', ');
			}
			return raw;
		} catch {
			return raw;
		}
	}
	if (Array.isArray(raw)) {
		return raw.join(', ');
	}
	return String(raw);
};

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
			rawIngredientsText.value = parseIngredientsToText(response.data.raw_ingredients)
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

	// 將逗號或換行分隔的成分文字整理成陣列的 JSON 字串
	const cleanIngredients = rawIngredientsText.value
		.split(/[,\n、;，；\s]+/)
		.map(s => s.trim())
		.filter(Boolean);

	try {
		const response = await $fetch<{ success: boolean; message?: string }>(`/api/cabinet/${productId}`, {
			method: 'PUT',
			body: {
				product_name: product.value.product_name,
				product_category: normalizeProductCategory(product.value.product_category),
				raw_ingredients: JSON.stringify(cleanIngredients),
				opened_at: tracking.opened_at || null,
				expires_at: tracking.expires_at || null,
				estimated_finish_days: tracking.estimated_finish_days,
				purchase_purpose: tracking.purchase_purpose || null,
				user_notes: tracking.user_notes || null
			}
		})

		if (response.success) {
			alert('產品與追蹤資料已更新')
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

// 以目前的產品名稱和成分來進行 AI 分析
const analyzeCurrentData = async () => {
	if (isAnalyzing.value) return
	if (!product.value?.product_name || !rawIngredientsText.value) {
		analysisError.value = '請填寫產品名稱與成分表文字再進行分析'
		return
	}

	isAnalyzing.value = true
	analysisError.value = ''
	analysisSuccessMsg.value = ''

	try {
		// 1. 呼叫 Gemini 分析 API
		const res = await $fetch<any>('/api/analyze', {
			method: 'POST',
			body: {
				productName: product.value.product_name,
				ingredientsText: rawIngredientsText.value,
				skinType: 'normal'
			}
		})

		if (!res || !res.data?.analysis) {
			throw new Error('AI 分析失敗，請檢查成分文字是否包含有效成分')
		}

		// 2. 將分析所得的數據寫回 user_cabinet 產品欄位中
		const updateRes = await $fetch<any>(`/api/cabinet/${productId}`, {
			method: 'PUT',
			body: {
				analysis_result: res.data || res,
				overview: res.data.overallSummary || '',
				raw_ingredients: res.data.rawIngredients || ''
			}
		})

		if (updateRes.success) {
			analysisSuccessMsg.value = 'AI 分析與保存成功！'
			// 3. 刷新資料以重新繪製最新的唯讀結果
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
				analysis_result: res.data || res,
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

.edit-grid {
	display: grid;
	grid-template-columns: 1.2fr 1fr;
	gap: var(--space-6);
	align-items: start;
}

@media (max-width: 768px) {
	.edit-grid {
		grid-template-columns: 1fr;
		gap: var(--space-4);
	}
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

/* 檢驗報告卡片樣式 */
.analysis-report-card {
	border: 1px solid var(--color-border);
	background: #FDFDFD;
	padding: var(--space-5);
}

.report-header {
	border-bottom: 2px solid var(--color-text-secondary);
	padding-bottom: var(--space-4);
	margin-bottom: var(--space-5);
}

.report-title {
	font-size: 18px;
	font-weight: 700;
	color: var(--color-text-primary);
	margin: 0 0 var(--space-1);
}

.report-subtitle {
	font-size: 12px;
	color: var(--color-text-muted);
	margin: 0;
}

.report-section {
	margin-bottom: var(--space-5);
}

.report-section:last-child {
	margin-bottom: 0;
}

.section-subtitle-small {
	font-size: 13px;
	font-weight: 700;
	color: var(--color-text-secondary);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin-bottom: var(--space-3);
	padding-bottom: var(--space-1);
	border-bottom: 1px dashed var(--color-border-light);
}

.overview-section {
	background: #F8F9FA;
	padding: var(--space-4);
	border-radius: var(--radius-md);
	border: 1px solid #ECECEC;
}

.overview-text {
	margin: 0;
	font-size: 14px;
	line-height: 1.6;
	color: var(--color-text-primary);
}

.report-list-container {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.report-item {
	padding: var(--space-3);
	border-radius: var(--radius-sm);
	background: #FCFCFC;
	border: 1px solid #F0F0F0;
}

.item-meta {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	margin-bottom: var(--space-1);
}

.item-name {
	font-size: 14px;
	color: var(--color-text-primary);
}

.item-desc {
	margin: 0;
	font-size: 13px;
	color: var(--color-text-secondary);
	line-height: 1.5;
}

.item-limit {
	color: var(--color-text-muted);
	font-size: 12px;
}

/* Badge 標籤系統 */
.report-badge {
	font-size: 11px;
	font-weight: 600;
	padding: 2px 6px;
	border-radius: var(--radius-sm);
}

.badge-critical {
	background: #FAF0F0;
	color: #A84242;
	border: 1px solid #F3D9D9;
}

.badge-warning {
	background: #FCF5EC;
	color: #B36B21;
	border: 1px solid #F7E5D0;
}

.badge-info {
	background: #F2F7FA;
	color: #3B728C;
	border: 1px solid #D7E7F0;
}

.badge-tfda {
	background: #F0F2FD;
	color: #4C599A;
	border: 1px solid #D2D9FA;
	font-weight: 700;
}

.safe-list-text {
	margin: 0;
	font-size: 13px;
	color: var(--color-text-secondary);
	line-height: 1.7;
	background: #FAFAFA;
	padding: var(--space-3) var(--space-4);
	border-radius: var(--radius-sm);
	border: 1px solid #F0F0F0;
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
