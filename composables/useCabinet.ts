import { onBeforeUnmount, ref, watch } from 'vue';

interface Product {
  id: string;
  user_id: string;
  product_name: string;
  product_category: string;
  raw_ingredients: string;
  analysis_result: any;
  overview?: string | null;
  created_at?: string;
  updated_at?: string;
  // 使用追蹤欄位
  opened_at?: string | null;
  estimated_finish_days?: number | null;
  purchase_purpose?: string | null;
  user_notes?: string | null;
  expires_at?: string | null;
  expiry_status?: 'expired' | 'soon' | 'ok' | null; // API 計算，非資料庫儲存
}

interface CabinetListMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface FetchProductsParams {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export const useCabinet = () => {
  // 響應式狀態
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const meta = ref<CabinetListMeta>({ total: 0, limit: 5, offset: 0, hasMore: false });
  const currentPage = ref(1);
  const pageSize = ref(5);
  const searchKeyword = ref('');
  const selectedCategory = ref('');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 從 API 獲取產品列表
   */
  const fetchProducts = async (params: FetchProductsParams = {}) => {
    const nextPageSize = params.pageSize ?? pageSize.value;
    const normalizedPageSize = Number.isFinite(nextPageSize) && nextPageSize > 0
      ? Math.floor(nextPageSize)
      : 5;

    const nextPage = params.page ?? currentPage.value;
    const normalizedPage = Number.isFinite(nextPage) && nextPage > 0
      ? Math.floor(nextPage)
      : 1;

    const nextSearch = params.search ?? searchKeyword.value;
    const nextCategory = params.category ?? selectedCategory.value;

    pageSize.value = normalizedPageSize;
    currentPage.value = normalizedPage;
    searchKeyword.value = nextSearch;
    selectedCategory.value = nextCategory;

    const offset = (currentPage.value - 1) * pageSize.value;

    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: boolean;
        data: Product[];
        meta?: CabinetListMeta;
      }>('/api/cabinet/list', {
        query: {
          search: searchKeyword.value || undefined,
          category: selectedCategory.value || undefined,
          limit: pageSize.value,
          offset
        }
      });
      
      if (response.success) {
        products.value = response.data;
        meta.value = response.meta || {
          total: response.data.length,
          limit: pageSize.value,
          offset,
          hasMore: false
        };
      } else {
        error.value = '無法載入產品列表';
      }
    } catch (err: any) {
      console.error('[useCabinet] fetchProducts 錯誤:', err);
      error.value = err.data?.message || err.message || '載入產品列表失敗';
    } finally {
      loading.value = false;
    }
  };

  const goToPage = async (page: number) => {
    if (!Number.isFinite(page) || page < 1) {
      return;
    }
    await fetchProducts({ page: Math.floor(page) });
  };

  const resetPage = () => {
    currentPage.value = 1;
  };

  const triggerDebouncedSearch = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      fetchProducts().catch((err) => {
        console.error('[useCabinet] debounce fetch 錯誤:', err);
      });
    }, 300);
  };

  watch([searchKeyword, selectedCategory], () => {
    resetPage();
    triggerDebouncedSearch();
  });

  onBeforeUnmount(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  });

  /**
   * 更新產品（支援基本資訊與追蹤欄位）
   */
  const updateProduct = async (productId: string, fields: Partial<Pick<Product,
    'product_name' | 'product_category' | 'opened_at' | 'estimated_finish_days' | 'purchase_purpose' | 'user_notes'
  >>) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ success: boolean; data: Product }>(`/api/cabinet/${productId}`, {
        method: 'PUT',
        body: fields
      });

      if (response.success) {
        const idx = products.value.findIndex(p => p.id === productId);
        if (idx !== -1) {
          products.value[idx] = { ...products.value[idx], ...response.data };
        }
        return response.data;
      }
    } catch (err: any) {
      console.error('[useCabinet] updateProduct 錯誤:', err);
      error.value = err.data?.message || err.message || '更新產品失敗';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 刪除單一產品
   */
  const deleteProduct = async (productId: string) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch(`/api/cabinet/${productId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        await fetchProducts();
      } else {
        error.value = '無法刪除產品';
      }
    } catch (err: any) {
      console.error('[useCabinet] deleteProduct 錯誤:', err);
      error.value = err.data?.message || err.message || '刪除產品失敗';
    } finally {
      loading.value = false;
    }
  };

  return {
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
    resetPage,
    updateProduct,
    deleteProduct
  };
};
