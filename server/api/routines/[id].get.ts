import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

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

  // 組合完整的 routine 對象
  return {
    success: true,
    data: {
      ...routineData,
      items: itemsData || [],
      all_products: (productsData || []).map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        product_category: p.product_category,
        raw_ingredients: p.raw_ingredients || '',
        is_recommendation: false
      }))
    },
    message: '成功取得排程'
  };
});
