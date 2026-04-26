<template>
  <div class="page-container--wide">
    <h1 class="page-main-title">我的保養計劃</h1>

    <div v-if="showLimitNotice" class="limit-banner">
      <span>{{ limitNoticeText }}</span>
      <button class="limit-close" @click="closeLimitNotice" title="關閉">✕</button>
    </div>

    <!-- 保養品庫存 -->
    <section class="card section-card">
      <h2 class="section-heading">保養品庫存</h2>

      <div class="cabinet-toolbar">
        <input
          v-model="cabinetSearchKeyword"
          type="text"
          class="form-input toolbar-search"
          placeholder="搜尋產品名稱或分類"
        />
        <select v-model="cabinetSelectedCategory" class="form-input toolbar-select">
          <option value="">全部分類</option>
          <option v-for="category in categoryOptions" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </div>

      <div v-if="cabinetLoading" class="status-box status-loading">載入中...</div>
      <div v-else-if="cabinetError" class="status-box status-error">{{ cabinetError }}</div>

      <div v-else-if="products.length === 0" class="empty-state">
        <p>還沒有添加任何保養品</p>
        <button class="btn btn-ghost btn-sm" @click="$router.push('/')">前往新增保養品</button>
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
            <td>
              <span v-if="product.analysis_result" class="badge badge-sage">✓ 已分析</span>
              <span v-else class="badge badge-amber">⏳ 待分析</span>
            </td>
            <td class="product-date">{{ formatDate(product.created_at) }}</td>
            <td>
              <button class="btn btn-sm btn-ghost" @click.stop="editProduct(product.id)">編輯</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="products.length > 0" class="pagination">
        <button
          class="btn btn-sm btn-secondary"
          :disabled="cabinetCurrentPage <= 1 || cabinetLoading"
          @click="goPrevCabinetPage"
        >上一頁</button>
        <span class="pagination-info">第 {{ cabinetCurrentPage }} 頁，共 {{ cabinetTotalPages }} 頁（{{ cabinetMeta.total }} 筆）</span>
        <button
          class="btn btn-sm btn-secondary"
          :disabled="!cabinetMeta.hasMore || cabinetLoading"
          @click="goNextCabinetPage"
        >下一頁</button>
      </div>
    </section>

    <!-- 保養排程 -->
    <section class="card section-card">
      <div class="section-header-row">
        <h2 class="section-heading" style="margin-bottom: 0;">我的排程</h2>
        <button class="btn btn-primary btn-sm" @click="goCreate">+ 建立新排程</button>
      </div>

      <div v-if="routinesLoading" class="status-box status-loading">載入排程中...</div>
      <div v-else-if="routinesError" class="status-box status-error">{{ routinesError }}</div>

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
          <div class="routine-card__header">
            <h3 class="routine-card__title">{{ routine.name }}</h3>
            <div class="routine-card__actions">
              <button
                :class="['btn-toggle', { 'btn-toggle--active': routine.is_active }]"
                :title="routine.is_active ? '停用此排程' : '啟用此排程'"
                @click.stop="toggleRoutineActive(routine.id, routine.is_active)"
              >
                {{ routine.is_active ? '✓ 啟用' : '○ 停用' }}
              </button>
              <button class="btn-delete" title="刪除此排程" @click.stop="deleteRoutine(routine.id, routine.name)">
                🗑️
              </button>
            </div>
          </div>

          <p class="routine-card__desc">{{ routine.description || '無描述' }}</p>

          <div v-if="getRoutineThemeTags(routine).length > 0" class="theme-tags">
            <span
              v-for="(tag, idx) in getRoutineThemeTags(routine)"
              :key="`routine-${routine.id}-theme-${idx}`"
              class="theme-tag"
            >#{{ tag }}</span>
          </div>

          <div class="routine-card__meta">
            <span :class="['badge', routine.created_by_ai ? 'badge-gold' : 'badge-muted']">
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

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

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
    limitTimer = setTimeout(() => { showLimitNotice.value = false; limitTimer = null }, 10000)
  }
})

onBeforeUnmount(() => {
  if (limitTimer) { clearTimeout(limitTimer); limitTimer = null }
})

const closeLimitNotice = () => {
  showLimitNotice.value = false
  if (limitTimer) { clearTimeout(limitTimer); limitTimer = null }
}

const getRoutineThemeTags = (routine: RoutineListItem) => {
  const predefined = Array.isArray(routine.themes)
    ? routine.themes
        .map(id => AVAILABLE_ROUTINE_THEMES.find(t => t.id === id)?.label || id)
        .map(l => String(l || '').trim())
        .filter(Boolean)
    : []
  const custom = Array.isArray(routine.custom_themes)
    ? routine.custom_themes.map(t => String(t || '').trim()).filter(Boolean)
    : []
  return Array.from(new Set([...predefined, ...custom]))
}

const goCreate = () => {
  if (routines.value.length >= MAX_ROUTINES) {
    limitNoticeText.value = `目前已有 ${MAX_ROUTINES} 個保養規劃，已達上限。請先刪除其中一個再新增。`
    showLimitNotice.value = true
    if (limitTimer) clearTimeout(limitTimer)
    limitTimer = setTimeout(() => { showLimitNotice.value = false; limitTimer = null }, 10000)
    return
  }
  router.push('/routines/new')
}

const goEdit = (id: string) => router.push(`/routines/${id}`)

const toggleRoutineActive = async (id: string, isCurrentlyActive?: boolean | null) => {
  try {
    const response = await $fetch<{ success: boolean }>(`/api/routines/${id}/toggle-active`, {
      method: 'PUT',
      body: { is_active: !Boolean(isCurrentlyActive) }
    })
    if (response.success) await fetchRoutines()
  } catch (error: any) {
    alert('無法更新排程狀態：' + (error.data?.message || error.message))
  }
}

const deleteRoutine = async (id: string, name: string) => {
  if (!confirm(`確定要刪除排程「${name}」嗎？此操作無法復原。`)) return
  try {
    const response = await $fetch<{ success: boolean }>(`/api/routines/${id}`, { method: 'DELETE' })
    if (response.success) await fetchRoutines()
  } catch (error: any) {
    alert('無法刪除排程：' + (error.data?.message || error.message))
  }
}

const editProduct = (productId: string) => router.push(`/products/${productId}/edit`)

const goPrevCabinetPage = async () => {
  if (cabinetCurrentPage.value <= 1) return
  await goToPage(cabinetCurrentPage.value - 1)
}

const goNextCabinetPage = async () => {
  if (!cabinetMeta.value.hasMore) return
  await goToPage(cabinetCurrentPage.value + 1)
}
</script>

<style scoped>
.page-main-title {
  font-size: 28px;
  margin-bottom: var(--space-6);
}

.limit-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-amber-light);
  border: 1px solid #DDB880;
  border-radius: var(--radius-md);
  color: #7A5A30;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: var(--space-5);
}

.limit-close {
  background: none;
  border: none;
  color: #7A5A30;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  flex-shrink: 0;
}

.section-card {
  margin-bottom: var(--space-6);
}

.section-heading {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.cabinet-toolbar {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.toolbar-search {
  flex: 1;
}

.toolbar-select {
  width: 180px;
}

/* Table */
.products-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.products-table thead {
  background: var(--color-surface-alt);
}

.products-table th {
  padding: var(--space-3) var(--space-3);
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.products-table td {
  padding: var(--space-3) var(--space-3);
  border-bottom: 1px solid var(--color-border-light);
}

.product-row {
  cursor: pointer;
  transition: background 0.15s;
}

.product-row:hover {
  background: var(--color-surface-alt);
}

.product-row:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
  background: var(--color-accent-light);
}

.product-name {
  font-weight: 500;
  color: var(--color-text-primary);
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 640px) {
  .products-table th:nth-child(3),
  .products-table td:nth-child(3),
  .products-table th:nth-child(4),
  .products-table td:nth-child(4) {
    display: none;
  }
  .product-name {
    max-width: 160px;
  }
}

.product-category {
  color: var(--color-text-secondary);
}

.product-date {
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);
}

.pagination-info {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* Routine cards grid */
.routines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.routine-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
  display: flex;
  flex-direction: column;
}

.routine-card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.routine-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.routine-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.routine-card__title {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  flex: 1;
}

.routine-card__actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.btn-toggle {
  padding: 3px 8px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-secondary);
  transition: all 0.15s;
  white-space: nowrap;
  font-family: var(--font-body);
}

.btn-toggle:hover {
  background: var(--color-border-light);
}

.btn-toggle--active {
  background: var(--color-sage-light);
  color: var(--color-sage);
  border-color: var(--color-sage);
}

.btn-delete {
  padding: 3px 7px;
  background: var(--color-red-light);
  border: 1px solid #E8C0C0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.btn-delete:hover {
  background: #F0D0D0;
}

.routine-card__desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0 0 var(--space-3);
  flex: 1;
}

.theme-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.theme-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-sage-light);
  border: 1px solid #C0D8C2;
  color: var(--color-sage);
  font-size: 11px;
  font-weight: 600;
}

.routine-card__meta {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
