import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type { WeeklyRoutine, RoutineItem, CabinetProductItem } from '~/types/routine';
import { normalizeProductCategory } from '~/utils/productCategories';

const OPTIONAL_CATEGORIES = new Set(['其他', '面膜', '眼霜']);

const USAGE_ORDER = [
  { category: '洗臉產品', timing: '早晚', tip: '清潔第一步，溫和帶走污垢' },
  { category: '化妝水', timing: '早晚', tip: '補水收斂，幫助後續成分吸收' },
  { category: '精華液', timing: '早晚', tip: '集中護理，針對肌膚問題' },
  { category: '眼霜', timing: '早晚', tip: '在乳液前使用，輕拍至吸收' },
  { category: '乳液', timing: '早晚', tip: '鎖水保濕，封住前一步驟成分' },
  { category: '面膜', timing: '晚間', tip: '建議 1–3 次/週，可替換精華步驟' },
  { category: '防曬', timing: '早晨', tip: '日間最後一步，需均勻補擦' },
] as const;

function extractReasonIngredients(reason?: string): string[] {
  const text = String(reason || '').trim();
  if (!text) return [];
  return text
    .replace(/[：:]/g, ' ')
    .split(/[、,，/\s]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2 && token.length <= 20)
    .slice(0, 5);
}

export function useRoutineRecommendations(
  routine: Ref<WeeklyRoutine | null>,
  availableProducts: Ref<CabinetProductItem[]>,
  categoryOptions: readonly string[],
  routineId: string
) {
  const aiSuggestedItems = ref<RoutineItem[]>([]);

  const normalizeCategory = (category?: string) => normalizeProductCategory(category);

  const recommendationItems = computed(() => {
    if (!routine.value) return [];
    return routine.value.items.filter(item => item.is_recommendation === true);
  });

  const recommendationSource = computed(() => [
    ...recommendationItems.value,
    ...aiSuggestedItems.value,
  ]);

  const missingCategories = computed(() => {
    const existing = new Set<string>(availableProducts.value.map(p => normalizeCategory(p.product_category)));
    return categoryOptions.filter(cat => cat !== '其他' && !existing.has(cat));
  });

  const unifiedRecommendations = computed(() => {
    const map = new Map<string, { productName: string; ingredients: Set<string> }>();

    for (const category of missingCategories.value) {
      if (!map.has(category)) {
        map.set(category, { productName: category, ingredients: new Set<string>() });
      }
    }

    for (const item of recommendationSource.value) {
      const category = normalizeCategory(item.product_category) || '其他';
      const displayName = String(item.product_name || '').trim() || category;

      if (!map.has(category)) {
        map.set(category, { productName: displayName, ingredients: new Set<string>() });
      }

      const target = map.get(category)!;
      for (const ingredient of Array.isArray(item.ingredients) ? item.ingredients : []) {
        const value = String(ingredient || '').trim();
        if (value) target.ingredients.add(value);
      }
      for (const ingredient of extractReasonIngredients(item.recommendation_reason)) {
        target.ingredients.add(ingredient);
      }
    }

    return Array.from(map.entries()).map(([category, value]) => {
      const ingredients = Array.from(value.ingredients).slice(0, 6);
      return {
        category,
        productName: value.productName,
        ingredients,
        ingredientsText: ingredients.length > 0 ? `推薦成分 ${ingredients.join('、')}` : '建議補齊此品類',
      };
    });
  });

  const isProductsSufficient = computed(() => {
    if (availableProducts.value.length === 0) return false;
    const coreCategories = (categoryOptions as readonly string[]).filter(c => !OPTIONAL_CATEGORIES.has(c));
    const missingCore = missingCategories.value.filter(c => !OPTIONAL_CATEGORIES.has(c));
    return missingCore.length === 0 && coreCategories.length > 0;
  });

  const usageOrderTips = computed(() => {
    const existing = new Set(availableProducts.value.map(p => normalizeCategory(p.product_category)));
    return USAGE_ORDER
      .filter(item => existing.has(item.category))
      .map((item, i) => ({ ...item, step: i + 1 }));
  });

  const loadTempRecommendations = () => {
    if (typeof window === 'undefined') return;
    const key = `routine-ai-recommendations:${routineId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        aiSuggestedItems.value = parsed.map((item: any): RoutineItem => ({
          day_of_week: 0,
          time_of_day: 'morning' as const,
          sequence_order: 0,
          product_name: String(item?.product_name || '').trim(),
          product_category: item?.product_category,
          ingredients: Array.isArray(item?.ingredients) ? item.ingredients : [],
          is_recommendation: true,
          recommendation_reason: item?.recommendation_reason || 'AI 推薦候選品項',
        })).filter(item => !!item.product_name);
      }
    } catch {
      aiSuggestedItems.value = [];
    } finally {
      sessionStorage.removeItem(key);
    }
  };

  return {
    aiSuggestedItems,
    recommendationSource,
    unifiedRecommendations,
    isProductsSufficient,
    usageOrderTips,
    loadTempRecommendations,
  };
}
