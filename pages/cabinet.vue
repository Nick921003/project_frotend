<template>
  <div>
    <h1>我的保養品櫃</h1>

    <div class="toolbar">
      <input
        v-model="searchKeyword"
        type="text"
        class="search-input"
        placeholder="搜尋產品名稱或分類"
      />
      <select v-model="selectedCategory" class="category-select">
        <option value="">全部分類</option>
        <option v-for="category in categoryOptions" :key="category" :value="category">
          {{ category }}
        </option>
      </select>
    </div>

    <!-- 載入狀態 -->
    <div v-if="loading">
      載入中...
    </div>

    <!-- 錯誤提示 -->
    <div v-if="error" style="color: red;">
      {{ error }}
    </div>

    <!-- 產品列表 -->
    <div v-if="!loading">
      <div v-if="products.length === 0">
        目前沒有產品
      </div>

      <ul v-else>
        <li
          v-for="product in products"
          :key="product.id"
          class="product-row"
          role="button"
          tabindex="0"
          :aria-label="`編輯產品 ${product.product_name}`"
          @click="goEditProduct(product.id)"
          @keydown.enter.prevent="goEditProduct(product.id)"
          @keydown.space.prevent="goEditProduct(product.id)"
        >
          <strong>{{ product.product_name }}</strong> - {{ product.product_category }}
          <button @click.stop="handleDeleteProduct(product.id)">
            刪除
          </button>
        </li>
      </ul>

      <div class="pagination">
        <button :disabled="currentPage <= 1 || loading" @click="goPrevPage">
          上一頁
        </button>
        <span>
          第 {{ currentPage }} 頁，共 {{ totalPages }} 頁（{{ meta.total }} 筆）
        </span>
        <button :disabled="!meta.hasMore || loading" @click="goNextPage">
          下一頁
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCabinet } from '~/composables/useCabinet';
import { PRODUCT_CATEGORIES } from '~/utils/productCategories';

// 使用 useCabinet composable
const {
  products,
  loading,
  error,
  meta,
  currentPage,
  pageSize,
  searchKeyword,
  selectedCategory,
  fetchProducts,
  goToPage,
  deleteProduct
} = useCabinet();
const router = useRouter();
const categoryOptions = PRODUCT_CATEGORIES;
const totalPages = computed(() => Math.max(1, Math.ceil(meta.value.total / pageSize.value)));

// 在元件掛載時獲取產品列表
onMounted(async () => {
  await fetchProducts();
});

// 處理刪除產品的點擊事件
const handleDeleteProduct = async (productId: string) => {
  const confirmed = confirm('確定要刪除此產品嗎？');
  if (confirmed) {
    await deleteProduct(productId);
  }
};

const goEditProduct = (productId: string) => {
  router.push(`/products/${productId}/edit`);
};

const goPrevPage = async () => {
  if (currentPage.value <= 1) {
    return;
  }
  await goToPage(currentPage.value - 1);
};

const goNextPage = async () => {
  if (!meta.value.hasMore) {
    return;
  }
  await goToPage(currentPage.value + 1);
};
</script>

<style scoped>
h1 {
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-input,
.category-select {
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.search-input {
  flex: 1;
}

ul {
  list-style: none;
  padding: 0;
}

.product-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #ccc;
  cursor: pointer;
}

.product-row:hover {
  background: #f8fafc;
}

.product-row:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
  background: #eff6ff;
}

button {
  padding: 5px 10px;
  cursor: pointer;
}

.pagination {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

div[style*="color: red"] {
  padding: 10px;
  background-color: #ffe0e0;
  border-radius: 4px;
  margin-bottom: 10px;
}
</style>
