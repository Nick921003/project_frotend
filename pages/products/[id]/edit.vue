<template>
  <div class="edit-container">
    <h1>編輯保養品</h1>

    <!-- 載入狀態 -->
    <div v-if="loading" class="loading">
      載入產品資訊中...
    </div>

    <!-- 錯誤提示 -->
    <div v-if="error" class="error">
      ❌ {{ error }}
    </div>

    <!-- 編輯表單 -->
    <form v-if="!loading && product" @submit.prevent="saveProduct" class="edit-form">
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

      <div class="form-group">
        <label for="raw_ingredients">成分</label>
        <textarea
          id="raw_ingredients"
          v-model="product.raw_ingredients"
          placeholder="輸入或貼上成分表"
          rows="6"
        ></textarea>
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
        product_category: normalizeProductCategory(product.value.product_category),
        raw_ingredients: product.value.raw_ingredients
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
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h1 {
  margin-top: 0;
  color: #333;
}

.loading,
.error {
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.error {
  background: #ffebee;
  color: #c62828;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1);
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
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
  background: #1890ff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0050b3;
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
</style>
