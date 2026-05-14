import { ref } from 'vue';
import type { WeeklyRoutine } from '~/types/routine';

/**
 * useCreateRoutine.ts
 * 排程頁面的共享 routine ref
 */
export const useCreateRoutine = () => {
  const routine = ref<WeeklyRoutine | null>(null);

  return { routine };
};
