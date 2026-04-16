import { ref } from 'vue';
import type { WeeklyRoutine, RoutinePreferences } from '~/types/routine';

/**
 * useCreateRoutine.ts
 * 用於生成每週保養規劃的 composable
 */
export const useCreateRoutine = () => {
  const routine = ref<WeeklyRoutine | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const generatedByAI = ref(false);
  const AI_CREATE_TIMEOUT_MS = 180000;
  const DEFAULT_CREATE_TIMEOUT_MS = 60000;

  /**
   * 使用 AI 生成保養規劃（支持 preferences）
   */
  const generateWithAI = async (preferences?: RoutinePreferences) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: boolean;
        data: WeeklyRoutine;
        message: string;
      }>('/api/routines/create', {
        method: 'POST',
        body: { 
          useAI: true,
          preferences: preferences || getDefaultPreferences()
        },
        timeout: AI_CREATE_TIMEOUT_MS
      });

      if (response.success) {
        routine.value = response.data;
        generatedByAI.value = true;
        console.log('[useCreateRoutine] AI 生成成功，routine_id:', response.data.routine_id, '項目數:', response.data.items?.length);
      } else {
        throw new Error('無法生成規劃');
      }
    } catch (err: any) {
      console.error('[useCreateRoutine] generateWithAI 錯誤:', err);
      const isTimeout = err?.name === 'TimeoutError' || String(err?.message || '').toLowerCase().includes('timeout');
      if (isTimeout) {
        error.value = 'AI 生成逾時（3 分鐘），請稍後再試。';
        return;
      }
      error.value = err.data?.message || err.message || '生成規劃失敗，請檢查個人資料是否完整';
    } finally {
      loading.value = false;
    }
  };

  /**
   * 生成預設規劃（不使用 AI）
   */
  const generateDefault = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: boolean;
        data: WeeklyRoutine;
        message: string;
      }>('/api/routines/create', {
        method: 'POST',
        body: { useAI: false },
        timeout: DEFAULT_CREATE_TIMEOUT_MS
      });

      if (response.success) {
        routine.value = response.data;
        generatedByAI.value = false;
        console.log('[useCreateRoutine] 預設規劃生成成功，routine_id:', response.data.routine_id, '項目數:', response.data.items?.length);
      } else {
        throw new Error('無法生成規劃');
      }
    } catch (err: any) {
      console.error('[useCreateRoutine] generateDefault 錯誤:', err);
      error.value = err.data?.message || err.message || '生成規劃失敗';
    } finally {
      loading.value = false;
    }
  };

  /**
   * 取得預設 preferences
   */
  const getDefaultPreferences = (): RoutinePreferences => ({
    complexity: 'standard',
    targetIssues: [],
    priority: 'effectiveness',
    allowRecommendations: true,
    recommendThreshold: 3
  });

  /**
   * 清除狀態
   */
  const reset = () => {
    routine.value = null;
    loading.value = false;
    error.value = null;
    generatedByAI.value = false;
  };

  return {
    routine,
    loading,
    error,
    generatedByAI,
    generateWithAI,
    generateDefault,
    getDefaultPreferences,
    reset
  };
};
