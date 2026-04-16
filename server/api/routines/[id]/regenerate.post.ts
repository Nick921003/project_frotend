import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import type { CabinetProduct, RoutineItem, RoutinePreferences, UserProfileData } from '~/types/routine';
import { getAIService } from '~/server/services/aiService';

const DEFAULT_PREFERENCES: RoutinePreferences = {
  complexity: 'standard',
  targetIssues: [],
  priority: 'effectiveness',
  allowRecommendations: true,
  recommendThreshold: 3
};

/**
 * POST /api/routines/[id]/regenerate
 * 以偏好設定重新生成「AI 推薦」，不自動改動既有排程
 */
export default defineEventHandler(async (event) => {
  const routineId = getRouterParam(event, 'id');
  if (!routineId) {
    throw createError({ statusCode: 400, statusMessage: '缺少 routineId' });
  }

  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入' });
  }

  const userId = user.id || user.sub;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  const body = (await readBody(event)) || {};
  const preferences: RoutinePreferences = body.preferences || DEFAULT_PREFERENCES;

  const supabase = await serverSupabaseClient(event);

  // 1) 驗證 routine 屬於該使用者
  const { data: routineData, error: routineError } = await (supabase as any)
    .from('routines')
    .select('id, name, description, created_by_ai, is_active')
    .eq('id', routineId)
    .eq('user_id', userId)
    .single();

  if (routineError || !routineData) {
    throw createError({ statusCode: 404, statusMessage: '排程不存在或無權限' });
  }

  // 2) 讀取現有項目（含鎖定）
  const { data: existingItems, error: existingError } = await (supabase as any)
    .from('routine_items')
    .select('*')
    .eq('routine_id', routineId)
    .eq('user_id', userId)
    .order('day_of_week, time_of_day, sequence_order');

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: '讀取現有排程項目失敗: ' + existingError.message });
  }

  // 3) 讀取 profile
  const { data: profileData, error: profileError } = await (supabase as any)
    .from('profiles')
    .select('id, base_skin_type, gender, birth_year, issues')
    .eq('id', userId)
    .single();

  if (profileError || !profileData) {
    throw createError({ statusCode: 400, statusMessage: '尚未建立個人資料，請先完成設定' });
  }

  const userProfile: UserProfileData = {
    id: profileData.id,
    base_skin_type: profileData.base_skin_type || 'normal',
    gender: profileData.gender || null,
    birth_year: profileData.birth_year || null,
    issues: profileData.issues || null
  };

  // 4) 讀取保養品櫃
  const { data: cabinetData, error: cabinetError } = await (supabase as any)
    .from('user_cabinet')
    .select('id, user_id, product_name, product_category, raw_ingredients, analysis_result, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (cabinetError) {
    throw createError({ statusCode: 500, statusMessage: '取得保養品櫃失敗: ' + cabinetError.message });
  }

  const products: CabinetProduct[] = cabinetData || [];

  if (products.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: '目前保養品櫃沒有產品，請先新增產品再重新生成排程'
    });
  }

  // 5) 生成新的 AI 結果
  const aiService = getAIService();
  const aiResponse = await aiService.generateDetailedRoutine(userProfile, products, preferences);

  const generatedItems: RoutineItem[] = (aiResponse.items || []).map((item: any) => ({
    day_of_week: item.day_of_week,
    time_of_day: item.time_of_day,
    sequence_order: item.sequence_order ?? 0,
    product_name: item.product_name,
    product_category: item.product_category,
    ingredients: item.ingredients || [],
    is_recommendation: item.is_recommendation === true,
    is_locked: false,
    recommendation_reason: item.recommendation_reason,
    notes: item.notes
  }));

  const lockedItems = (existingItems || []).filter((item: any) => item.is_locked === true);

  const existingProductNames = new Set(
    (existingItems || [])
      .filter((item: any) => item.is_recommendation !== true)
      .map((item: any) => String(item.product_name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const aiRecommendedOnly = generatedItems.filter(item => item.is_recommendation === true);
  const fallbackSuggestions = generatedItems.filter(item => {
    const key = String(item.product_name || '').trim().toLowerCase();
    return key && !existingProductNames.has(key);
  });

  const candidateSuggestions = aiRecommendedOnly.length > 0 ? aiRecommendedOnly : fallbackSuggestions;
  const uniqueMap = new Map<string, RoutineItem>();

  for (const item of candidateSuggestions) {
    const name = String(item.product_name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (uniqueMap.has(key)) continue;

    uniqueMap.set(key, {
      product_name: name,
      product_category: item.product_category,
      ingredients: item.ingredients || [],
      is_recommendation: true,
      recommendation_reason: item.recommendation_reason || '可納入此排程主題的候選品項',
      day_of_week: 0,
      time_of_day: 'morning',
      sequence_order: 0
    });
  }

  const recommendations = Array.from(uniqueMap.values());
  const changedCount = recommendations.length;

  return {
    success: true,
    changed: false,
    threshold: 0,
    changed_count: changedCount,
    message: `已產生 ${changedCount} 項 AI 推薦，排程內容未自動變更`,
    data: {
      routine_id: routineId,
      name: routineData.name,
      description: routineData.description,
      recommendations,
      recommendation_mark: {
        marked: true,
        added: recommendations.map(i => i.product_name),
        removed: [],
        locked_count: lockedItems.length
      }
    }
  };
});