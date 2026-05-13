import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { detectConflicts } from '~/server/utils/ingredientConflicts';

/**
 * GET /api/routines/:id
 * 根據 routine ID 獲取完整排程信息
 */
export default defineEventHandler(async (event) => {
  // 驗證使用者
  const user = await serverSupabaseUser(event);

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入' });
  }

  const userId = user.id || user.sub;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  // 獲取 routine ID 參數
  const routineId = getRouterParam(event, 'id');

  if (!routineId) {
    throw createError({ statusCode: 400, statusMessage: '缺少 routine ID' });
  }

  const supabase = await serverSupabaseClient(event);

  // 查詢該 routine
  const { data: routineData, error: routineError } = (await (supabase as any)
    .from('routines')
    .select('*')
    .eq('id', routineId)
    .eq('user_id', userId)
    .single()) as any;

  if (routineError) {
    if (routineError.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        statusMessage: '排程不存在'
      });
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '查詢排程失敗: ' + routineError.message
    });
  }

  // 查詢該 routine 的所有排程項目
  const { data: itemsData, error: itemsError } = (await (supabase as any)
    .from('routine_items')
    .select('*')
    .eq('routine_id', routineId)
    .order('day_of_week, time_of_day, sequence_order')) as any;

  if (itemsError) {
    console.error('[Get Routine - Items Error]:', itemsError);
    throw createError({
      statusCode: 500,
      statusMessage: '查詢排程項目失敗: ' + itemsError.message
    });
  }

  // 查詢該用戶的所有產品（作為可用產品列表）
  const { data: productsData, error: productsError } = (await (supabase as any)
    .from('user_cabinet')
    .select('*')
    .eq('user_id', userId)) as any;

  if (productsError) {
    console.error('[Get Routine - Products Error]:', productsError);
    // 不要因為無法取得產品而失敗
  }

  // 找出哪些 product_id 仍在保養品櫃（用於孤兒標示）
  const existingProductIds = new Set<string>(
    (productsData || []).map((p: any) => p.id).filter(Boolean)
  );

  // 將 is_orphan 旗標附加到 items
  const itemsWithOrphan = (itemsData || []).map((item: any) => ({
    ...item,
    is_orphan: item.product_id != null && !existingProductIds.has(item.product_id)
  }));

  // 建立 productId → raw_ingredients 快查表，用於衝突偵測
  const productIngredientMap = new Map<string, string>();
  for (const p of (productsData || [])) {
    if (p.id && p.raw_ingredients) {
      productIngredientMap.set(p.id, String(p.raw_ingredients).toLowerCase());
    }
  }

  // 計算各天的成分衝突
  const conflictsByDay: Record<number, { rule: string; message: string }[]> = {};
  for (let day = 0; day < 7; day++) {
    const dayItems = itemsWithOrphan.filter((i: any) => i.day_of_week === day);
    const allIngredients = dayItems
      .map((i: any) => {
        if (Array.isArray(i.ingredients) && i.ingredients.length > 0) return i.ingredients as string[];
        if (i.product_id && productIngredientMap.has(i.product_id)) {
          return [productIngredientMap.get(i.product_id)!];
        }
        return [] as string[];
      })
      .filter((arr: string[]) => arr.length > 0);
    const warnings = detectConflicts(allIngredients);
    if (warnings.length > 0) conflictsByDay[day] = warnings;
  }

  // 組合完整的 routine 對象
  return {
    success: true,
    data: {
      ...routineData,
      items: itemsWithOrphan,
      conflicts_by_day: conflictsByDay,
      all_products: (productsData || []).map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        product_category: p.product_category,
        raw_ingredients: p.raw_ingredients || '',
        analysis_result: p.analysis_result || null,
        is_recommendation: false
      }))
    },
    message: '成功取得排程'
  };
});
