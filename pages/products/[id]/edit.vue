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

    <!-- AI 分析結果（唯讀） -->
    <div v-if="product?.analysis_result?.analysis" class="card analysis-card">
      <h2 class="section-title" style="font-size: 18px; border-bottom: 1px solid var(--color-border-light); padding-bottom: var(--space-4);">AI 分析結果</h2>

      <div v-if="product.overview" class="alert-block alert-gold">
        <h4>— AI 配方師總評</h4>
        <p style="margin: 0;">{{ product.overview }}</p>
      </div>

      <div v-if="product.analysis_result.analysis.regulatoryAlerts?.length > 0" class="alert-block alert-red">
        <h4>🔴 法規警告成分</h4>
        <ul>
          <li v-for="item in product.analysis_result.analysis.regulatoryAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong>
            <span v-if="item.source === 'TFDA'" class="badge badge-red" style="margin: 0 var(--space-2); font-size: 11px;">TFDA</span>
            {{ item.warning }}
            <span v-if="item.limit" style="color: var(--color-text-muted);">（限量：{{ item.limit }}）</span>
          </li>
        </ul>
      </div>

      <div v-if="product.analysis_result.analysis.limitAlerts?.length > 0" class="alert-block alert-orange">
        <h4>🟠 含限量成分（濃度未知）</h4>
        <ul>
          <li v-for="item in product.analysis_result.analysis.limitAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong>
            <span v-if="item.source === 'TFDA'" class="badge badge-amber" style="margin: 0 var(--space-2); font-size: 11px;">TFDA</span>
            <span v-if="item.limit" style="color: var(--color-text-muted);">法規限量：{{ item.limit }}</span>
          </li>
        </ul>
      </div>

      <div v-if="product.analysis_result.analysis.skinTypeAlerts?.length > 0" class="alert-block alert-yellow">
        <h4>🟡 膚質注意成分</h4>
        <ul>
          <li v-for="item in product.analysis_result.analysis.skinTypeAlerts" :key="item.inci_name">
            <strong>{{ item.inci_name }}</strong> {{ item.risk_description }}
          </li>
        </ul>
      </div>

      <div v-if="product.analysis_result.analysis.safeList?.length > 0" class="alert-block alert-green" style="margin-bottom: 0;">
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

.analysis-card {
  margin-top: var(--space-5);
}

.safe-list {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}
</style>
