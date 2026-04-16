import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * 用戶資料 Interface
 */
export interface UserProfile {
  id: string;
  base_skin_type: string;
  age_group: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birth_year: number | null;
  issues: string | null; // JSON 字串或逗號分隔
  created_at: string;
  updated_at: string;
}

/**
 * 使用者檔案 Pinia Store
 * 集中管理用戶個人資料狀態
 */
export const useUserProfile = defineStore('userProfile', () => {
  // ==================
  // 狀態（State）
  // ==================
  const profile = ref<UserProfile | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const saveSuccess = ref(false);

  // ==================
  // 計算屬性（Computed）
  // ==================
  /**
   * 計算使用者年齡（根據出生年份）
   */
  const userAge = computed(() => {
    if (!profile.value?.birth_year) return null;
    const currentYear = new Date().getFullYear();
    return currentYear - profile.value.birth_year;
  });

  /**
   * 將 issues 字串轉換為陣列
   */
  const issuesArray = computed(() => {
    if (!profile.value?.issues) return [];
    try {
      // 嘗試解析 JSON
      const parsed = JSON.parse(profile.value.issues);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // 如果不是 JSON，則按逗號分隔
      return profile.value.issues
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
  });

  // ==================
  // 方法（Actions）
  // ==================

  /**
   * 從後端取得使用者資料
   */
  const fetchUserProfile = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ success: boolean; data: UserProfile | null }>('/api/profile/get');

      if (response.success) {
        profile.value = response.data;
      } else {
        error.value = '無法取得使用者資料';
      }
    } catch (err: any) {
      console.error('[useUserProfile] fetchUserProfile 錯誤:', err);
      error.value = err.data?.message || err.message || '取得使用者資料失敗';
    } finally {
      loading.value = false;
    }
  };

  /**
   * 更新使用者資料
   */
  const updateUserProfile = async (data: {
    base_skin_type?: string | null;
    age_group?: string | null;
    birth_year?: number | null;
    skinType?: string;
    ageGroup?: string | null;
    birthYear?: number | null;
    issues?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
  }) => {
    const payload: Record<string, any> = {
      base_skin_type: data.base_skin_type ?? data.skinType,
      age_group: data.age_group ?? data.ageGroup,
      birth_year: data.birth_year ?? data.birthYear,
      gender: data.gender,
      issues: data.issues
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    loading.value = true;
    error.value = null;
    saveSuccess.value = false;

    try {
      const response = await $fetch<{ success: boolean; data: UserProfile }>('/api/profile/update', {
        method: 'POST',
        body: payload
      });

      if (response.success && response.data) {
        profile.value = response.data;
        saveSuccess.value = true;
        // 3 秒後清除成功提示
        setTimeout(() => {
          saveSuccess.value = false;
        }, 3000);
      } else {
        error.value = '無法更新使用者資料';
      }
    } catch (err: any) {
      console.error('[useUserProfile] updateUserProfile 錯誤:', err);
      error.value = err.data?.message || err.message || '更新使用者資料失敗';
    } finally {
      loading.value = false;
    }
  };

  /**
   * 清除狀態
   */
  const clearProfile = () => {
    profile.value = null;
    loading.value = false;
    error.value = null;
    saveSuccess.value = false;
  };

  return {
    // 狀態
    profile,
    loading,
    error,
    saveSuccess,

    // 計算屬性
    userAge,
    issuesArray,

    // 方法
    fetchUserProfile,
    updateUserProfile,
    clearProfile
  };
});
