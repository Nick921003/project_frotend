<template>
  <div class="edit-container">
    <h1>編輯保養品</h1>

    <div v-if="loading" class="status-box status-loading">載入產品資訊中...</div>
    <div v-if="error" class="status-box status-error">❌ {{ error }}</div>

    <form v-if="!loading && product" @submit.prevent="saveProduct" class="edit-form">
      <div class="form-card">
      <div class="form-group">
        <label for="product_name">產品名稱</label>
        <input
          id="product_name"
          v-model="product.product_name"
        type="text"
        placeholder="輸入產品名稱"
        required
        />
      </div>

      <div class="form-group">
        <label for="product_category">分類</label>
        <select id="product_category" v-model="product.product_category" required>
          <option value="">請選擇分類</option>
          <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
        </select>
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
      </div>
    </form>

    <!-- AI 分析結果（唯讀） -->
    <div v-if="product?.analysis_result?.analysis" class="analysis-panel">
      <h2>AI 分析結果</h2>

      <div v-if="product.overview" class="summary-box">
        <h4>✨ AI 配方師總評</h4>
        <p>{{ product.overview }}</p>
      </div>

      <div v-if="product.analysis_result.analysis.regulatoryAlerts?.length > 0" class="alert-box alert-red">
        <h4>🔴 法規警告成分</h4>
        <ul>
          <li v-for="item in product.analysis_result.analysis.regulatoryAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong>
            <span v-if="item.source === 'TFDA'" class="badge-tfda">TFDA</span>
            {{ item.warning }}
            <span v-if="item.limit">（限量：{{ item.limit }}）</span>
          </li>
        </ul>
      </div>

      <div v-if="product.analysis_result.analysis.limitAlerts?.length > 0" class="alert-box alert-orange">
        <h4>🟠 含限量成分（濃度未知）</h4>
        <ul>
          <li v-for="item in product.analysis_result.analysis.limitAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong>
            <span v-if="item.source === 'TFDA'" class="badge-tfda">TFDA</span>
            <span v-if="item.limit">法規限量：{{ item.limit }}</span>
          </li>
        </ul>
      </div>

      <div v-if="product.analysis_result.analysis.skinTypeAlerts?.length > 0" class="alert-box alert-yellow">
        <h4>🟡 膚質注意成分</h4>
        <ul>
          <li v-for="item in product.analysis_result.analysis.skinTypeAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong> {{ item.risk_description }}
          </li>
        </ul>
      </div>

      <div v-if="product.analysis_result.analysis.safeList?.length > 0" class="safe-box">
        <h4>✅ 其他成分（無法規標記）</h4>
        <p class="safe-list">{{ product.analysis_result.analysis.safeList.join('、') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

// 獲取產品詳情
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

// 保存產品
const saveProduct = async () => {
  if (!product.value || !productId) return

  isSaving.value = true
  error.value = null

  try {
    // 調用更新 API
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

// 刪除產品
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

// 返回上一頁
const goBack = () => {
  router.push('/beauty-plan')
}

onMounted(() => {
  fetchProduct()
})
</script>

<style scoped>
.edit-container {
  max-width: 680px;
  margin: 2rem auto;
  padding: 2rem;
  background: #f9fafb;
  min-height: 100vh;
}

h1 {
  margin-top: 0;
  font-size: 2rem;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.status-box {
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-weight: 500;
}

.status-loading {
  background: #eff6ff;
  color: #0c4a6e;
}

.status-error {
  background: #fef2f2;
  color: #991b1b;
}

.form-card {
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem 2rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.edit-form {
  display: contents;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.25rem;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #374151;
}

.form-group input,
.form-group select {
  padding: 0.65rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  flex: 1;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #d9d9d9;
  color: #333;
}

.btn-secondary:hover {
  background: #bfbfbf;
}

.btn-danger {
  background: #ff4d4f;
  color: white;
}

.btn-danger:hover {
  background: #cf1322;
}

.analysis-panel {
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.analysis-panel h2 {
  margin-top: 0;
  font-size: 1.5rem;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
}

.summary-box {
  padding: 12px 16px;
  background: #f3f0ff;
  border-left: 5px solid #722ed1;
  border-radius: 4px;
  margin-bottom: 12px;
}
.summary-box h4 { margin: 0 0 6px; color: #531dab; }
.summary-box p { margin: 0; line-height: 1.6; }

.alert-box {
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 12px;
}
.alert-box h4 { margin: 0 0 8px; }
.alert-box ul { margin: 0; padding-left: 1.2rem; }
.alert-box li { margin-bottom: 4px; font-size: 0.9rem; line-height: 1.5; }

.alert-red  { background: #fff1f0; border-left: 5px solid #ff4d4f; }
.alert-red h4 { color: #a8071a; }
.alert-orange { background: #fff7e6; border-left: 5px solid #fa8c16; }
.alert-orange h4 { color: #d46b08; }
.alert-yellow { background: #fffbe6; border-left: 5px solid #fadb14; }
.alert-yellow h4 { color: #876800; }

.badge-tfda {
  display: inline-block;
  font-size: 0.7rem;
  background: #e6f4ff;
  color: #096dd9;
  border: 1px solid #91caff;
  border-radius: 3px;
  padding: 0 4px;
  margin: 0 4px;
  vertical-align: middle;
}

.safe-box {
  padding: 12px 16px;
  background: #f6ffed;
  border-left: 5px solid #52c41a;
  border-radius: 4px;
}
.safe-box h4 { margin: 0 0 6px; color: #237804; }
.safe-list { margin: 0; font-size: 0.85rem; color: #555; line-height: 1.7; }
</style>
