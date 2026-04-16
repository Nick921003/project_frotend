<template>
  <div class="container">
    <h1>📋 我的保養計劃</h1>

    <div v-if="showLimitNotice" class="limit-banner">
      <span>{{ limitNoticeText }}</span>
      <button class="limit-close" @click="closeLimitNotice" title="關閉">✕</button>
    </div>

    <!-- 保養品庫存部分 -->
    <section class="section">
      <h2>🧴 保養品庫存</h2>
      <div class="cabinet-toolbar">
        <input
          v-model="cabinetSearchKeyword"
          type="text"
          class="search-input"
          placeholder="搜尋產品名稱或分類"
        >
        <select v-model="cabinetSelectedCategory" class="category-select">
          <option value="">全部分類</option>
          <option v-for="category in categoryOptions" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </div>

      <div v-if="cabinetLoading" class="loading">載入中...</div>
      <div v-else-if="cabinetError" class="error">{{ cabinetError }}</div>
      <div v-else-if="products.length === 0" class="empty-state">
        <p>還沒有添加任何保養品</p>
        <button @click="$router.push('/cabinet')" class="btn btn-secondary">前往新增保養品</button>
      </div>
      <table v-else class="products-table">
        <thead>
          <tr>
            <th>產品名稱</th>
            <th>分類</th>
            <th>分析狀態</th>
            <th>新增時間</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="product in products"
            :key="product.id"
            class="product-row"
            role="button"
            tabindex="0"
            :aria-label="`編輯產品 ${product.product_name}`"
            @click="editProduct(product.id)"
            @keydown.enter.prevent="editProduct(product.id)"
            @keydown.space.prevent="editProduct(product.id)"
          >
            <td class="product-name">{{ product.product_name }}</td>
            <td class="product-category">{{ product.product_category }}</td>
            <td class="analysis-status">
              <span v-if="product.analysis_result" class="badge badge-success">✓ 已分析</span>
              <span v-else class="badge badge-warning">⏳ 待分析</span>
            </td>
            <td class="created-date">{{ formatDate(product.created_at) }}</td>
            <td class="actions">
              <button @click.stop="editProduct(product.id)" class="btn btn-small btn-primary">編輯</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="products.length > 0" class="pagination">
        <button class="btn btn-small btn-secondary" :disabled="cabinetCurrentPage <= 1 || cabinetLoading" @click="goPrevCabinetPage">
          上一頁
        </button>
        <span>第 {{ cabinetCurrentPage }} 頁，共 {{ cabinetTotalPages }} 頁（{{ cabinetMeta.total }} 筆）</span>
        <button class="btn btn-small btn-secondary" :disabled="!cabinetMeta.hasMore || cabinetLoading" @click="goNextCabinetPage">
          下一頁
        </button>
      </div>
    </section>

    <!-- 保養排程部分 -->
    <section class="section">
      <h2>📅 我的排程</h2>
      <button @click="goCreate" class="btn btn-primary">+ 建立新排程</button>
      
      <div v-if="routinesLoading" class="loading">載入排程中...</div>
      <div v-else-if="routinesError" class="error">{{ routinesError }}</div>
      <div v-else-if="routines.length === 0" class="empty-state">
        <p>還沒有建立任何排程</p>
      </div>
      <div v-else class="routines-grid">
        <div
          v-for="routine in routines"
          :key="routine.id"
          class="routine-card"
          role="button"
          tabindex="0"
          :aria-label="`開啟排程 ${routine.name}`"
          @click="goEdit(routine.id)"
          @keydown.enter.prevent="goEdit(routine.id)"
          @keydown.space.prevent="goEdit(routine.id)"
        >
          <div class="card-header">
            <h3 class="routine-title">{{ routine.name }}</h3>
            <div class="card-actions">
              <button 
                @click.stop="toggleRoutineActive(routine.id, routine.is_active)"
                :class="['btn-toggle', { 'btn-active': routine.is_active }]"
                :title="routine.is_active ? '停用此排程' : '啟用此排程'"
              >
                {{ routine.is_active ? '✓ 啟用' : '○ 停用' }}
              </button>
              <button 
                @click.stop="deleteRoutine(routine.id, routine.name)"
                class="btn-delete"
                title="刪除此排程"
              >
                🗑️
              </button>
            </div>
          </div>
          <p class="description">{{ routine.description || '無描述' }}</p>
          <div v-if="getRoutineThemeTags(routine).length > 0" class="routine-theme-tags">
            <span
              v-for="(themeTag, idx) in getRoutineThemeTags(routine)"
              :key="`routine-${routine.id}-theme-${idx}`"
              class="routine-theme-tag"
            >
              #{{ themeTag }}
            </span>
          </div>
          <div class="meta">
            <span class="badge" :class="routine.created_by_ai ? 'badge-ai' : 'badge-manual'">
              {{ routine.created_by_ai ? '🤖 AI 生成' : '✋ 手動建立' }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AVAILABLE_ROUTINE_THEMES } from '~/types/routine'
import { useCabinet } from '~/composables/useCabinet'
import { PRODUCT_CATEGORIES } from '~/utils/productCategories'

interface RoutineListItem {
  id: string
  name: string
  description?: string | null
  created_by_ai?: boolean | null
  is_active?: boolean | null
  themes?: string[] | null
  custom_themes?: string[] | null
}

const router = useRouter()
const route = useRoute()
const {
  products,
  loading: cabinetLoading,
  error: cabinetError,
  meta: cabinetMeta,
  currentPage: cabinetCurrentPage,
  pageSize: cabinetPageSize,
  searchKeyword: cabinetSearchKeyword,
  selectedCategory: cabinetSelectedCategory,
  fetchProducts,
  goToPage
} = useCabinet()
const routines = ref<RoutineListItem[]>([])
const routinesLoading = ref(true)
const routinesError = ref<string | null>(null)
const showLimitNotice = ref(false)
const limitNoticeText = ref('')
const MAX_ROUTINES = 3
const categoryOptions = PRODUCT_CATEGORIES
const cabinetTotalPages = computed(() => Math.max(1, Math.ceil(cabinetMeta.value.total / cabinetPageSize.value)))
let limitTimer: ReturnType<typeof setTimeout> | null = null

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-TW', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  })
}

// 獲取排程列表
const fetchRoutines = async () => {
  routinesLoading.value = true
  routinesError.value = null
  try {
    const response = await $fetch<{ success: boolean; data: RoutineListItem[] }>('/api/routines/list')
    if (response.success) {
      routines.value = response.data
    } else {
      routinesError.value = '無法載入排程列表'
    }
  } catch (error: any) {
    console.error('Fetch routines error:', error)
    routinesError.value = error.data?.message || '載入排程失敗'
  } finally {
    routinesLoading.value = false
  }
}

onMounted(() => {
  fetchProducts()
  fetchRoutines()

  if (route.query.limit === '1') {
    const max = typeof route.query.max === 'string' ? route.query.max : String(MAX_ROUTINES)
    limitNoticeText.value = `目前已有 ${max} 個保養規劃，已達上限。請先刪除其中一個再新增。`
    showLimitNotice.value = true

    if (limitTimer) clearTimeout(limitTimer)
    limitTimer = setTimeout(() => {
      showLimitNotice.value = false
      limitTimer = null
    }, 10000)
  }
})

onBeforeUnmount(() => {
  if (limitTimer) {
    clearTimeout(limitTimer)
    limitTimer = null
  }
})

const closeLimitNotice = () => {
  showLimitNotice.value = false
  if (limitTimer) {
    clearTimeout(limitTimer)
    limitTimer = null
  }
}

const getRoutineThemeTags = (routine: RoutineListItem) => {
  const predefined = Array.isArray(routine.themes)
    ? routine.themes
        .map((themeId) => AVAILABLE_ROUTINE_THEMES.find(theme => theme.id === themeId)?.label || themeId)
        .map(label => String(label || '').trim())
        .filter(Boolean)
    : []

  const custom = Array.isArray(routine.custom_themes)
    ? routine.custom_themes
        .map(theme => String(theme || '').trim())
        .filter(Boolean)
    : []

  return Array.from(new Set([...predefined, ...custom]))
}

const goCreate = () => {
  if (routines.value.length >= MAX_ROUTINES) {
    limitNoticeText.value = `目前已有 ${MAX_ROUTINES} 個保養規劃，已達上限。請先刪除其中一個再新增。`
    showLimitNotice.value = true
    if (limitTimer) clearTimeout(limitTimer)
    limitTimer = setTimeout(() => {
      showLimitNotice.value = false
      limitTimer = null
    }, 10000)
    return
  }

  router.push('/routines/new')
}

const goEdit = (id: string) => {
  router.push(`/routines/${id}`)
}

const toggleRoutineActive = async (id: string, isCurrentlyActive?: boolean | null) => {
  try {
    const response = await $fetch<{ success: boolean }>(`/api/routines/${id}/toggle-active`, {
      method: 'PUT',
      body: { is_active: !Boolean(isCurrentlyActive) }
    })
    if (response.success) {
      await fetchRoutines()
    }
  } catch (error: any) {
    console.error('Toggle routine error:', error)
    alert('無法更新排程狀態：' + (error.data?.message || error.message))
  }
}

const deleteRoutine = async (id: string, name: string) => {
  if (!confirm(`確定要刪除排程「${name}」嗎？此操作無法復原。`)) {
    return
  }
  try {
    const response = await $fetch<{ success: boolean }>(`/api/routines/${id}`, {
      method: 'DELETE'
    })
    if (response.success) {
      await fetchRoutines()
    }
  } catch (error: any) {
    console.error('Delete routine error:', error)
    alert('無法刪除排程：' + (error.data?.message || error.message))
  }
}

const editProduct = (productId: string) => {
  // 導航到產品編輯頁面
  router.push(`/products/${productId}/edit`)
}

const goPrevCabinetPage = async () => {
  if (cabinetCurrentPage.value <= 1) {
    return
  }
  await goToPage(cabinetCurrentPage.value - 1)
}

const goNextCabinetPage = async () => {
  if (!cabinetMeta.value.hasMore) {
    return
  }
  await goToPage(cabinetCurrentPage.value + 1)
}
</script>

<style scoped>
.container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  background: #f9fafb;
  min-height: 100vh;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #1f2937;
}

.section {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.limit-banner {
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-weight: 600;
}

.limit-close {
  border: none;
  background: transparent;
  color: #92400e;
  cursor: pointer;
  font-size: 1rem;
}

.section h2 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 1rem;
}

.cabinet-toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.search-input,
.category-select {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
}

.search-input {
  flex: 1;
}

/* 按鈕樣式 */
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-primary {
  background: #667eea;
  color: white;
  margin-bottom: 1rem;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
  margin-top: 1rem;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn-small {
  padding: 6px 12px;
  font-size: 0.85rem;
  margin: 0;
}

/* 表格樣式 */
.products-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.products-table thead {
  background: #f3f4f6;
  border-bottom: 2px solid #e5e7eb;
}

.products-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
}

.products-table td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.product-row:hover {
  background: #f9fafb;
}

.product-row {
  cursor: pointer;
}

.product-row:focus-visible {
  outline: 2px solid #667eea;
  outline-offset: -2px;
  background: #eef2ff;
}

.product-name {
  font-weight: 500;
  color: #1f2937;
}

.product-category {
  color: #6b7280;
}

.actions {
  text-align: center;
}

.pagination {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.pagination .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 徽章樣式 */
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.badge-success {
  background: #d1fae5;
  color: #065f46;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.badge-ai {
  background: #dbeafe;
  color: #0c4a6e;
}

.badge-manual {
  background: #f3e8ff;
  color: #5b21b6;
}

.badge-active {
  background: #dcfce7;
  color: #166534;
}

/* 排程卡片 */
.routines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.routine-card {
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.routine-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.routine-card .routine-title {
  margin: 0;
  color: #1f2937;
  font-size: 1.1rem;
  cursor: pointer;
  flex: 1;
  transition: color 0.2s;
}

.routine-card .routine-title:hover {
  color: #667eea;
}

.routine-card .card-actions {
  display: flex;
  gap: 0.5rem;
}

.routine-card .btn-toggle {
  padding: 4px 8px;
  background: #e5e7eb;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
  color: #6b7280;
  white-space: nowrap;
}

.routine-card .btn-toggle.btn-active {
  background: #dbeafe;
  color: #0284c7;
  border-color: #0284c7;
}

.routine-card .btn-toggle:hover {
  background: #d1d5db;
}

.routine-card .btn-delete {
  padding: 4px 8px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.routine-card .btn-delete:hover {
  background: #fecaca;
}

.routine-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  transform: translateY(-4px);
}

.routine-card .description {
  color: #6b7280;
  font-size: 0.9rem;
  margin: 0 0 1rem 0;
  line-height: 1.5;
  cursor: pointer;
  transition: color 0.2s;
}

.routine-card .description:hover {
  color: #667eea;
}

.routine-theme-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 0.9rem;
}

.routine-theme-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid #86efac;
  background: #ecfdf3;
  color: #166534;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
}

.routine-card .meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* 空狀態 */
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #6b7280;
}

.empty-state p {
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

/* 載入和錯誤狀態 */
.loading,
.error {
  text-align: center;
  padding: 2rem;
  border-radius: 6px;
  font-weight: 500;
}

.loading {
  background: #eff6ff;
  color: #0c4a6e;
}

.error {
  background: #fef2f2;
  color: #991b1b;
}
</style>
