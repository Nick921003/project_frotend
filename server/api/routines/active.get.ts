import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

/**
 * GET /api/routines/active
 * 獲取使用者的 active routine（包含完整的排程項目）
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

  const supabase = await serverSupabaseClient(event);

  // 查詢該用戶的 active routine
  const { data: routineData, error: routineError } = (await (supabase as any)
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()) as any;

  if (routineError) {
    // 如果沒有 active routine，返回 null
    if (routineError.code === 'PGRST116') {
      return {
        success: true,
        data: null,
        message: '用戶未有 active routine'
      };
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '查詢 routine 失敗: ' + routineError.message
    });
  }

  // 如果找到 routine，獲取其所有排程項目
  if (routineData) {
    const { data: itemsData, error: itemsError } = (await (supabase as any)
      .from('routine_items')
      .select('*')
      .eq('routine_id', routineData.id)
      .order('day_of_week, time_of_day, sequence_order')) as any;

    if (itemsError) {
      console.error('[Active Routine - Items Error]:', itemsError);
      throw createError({
        statusCode: 500,
        statusMessage: '查詢排程項目失敗: ' + itemsError.message
      });
    }

    // 組合完整的 routine 對象
    return {
      success: true,
      data: {
        ...routineData,
        items: itemsData || []
      },
      message: '成功取得 active routine'
    };
  }

  return {
    success: true,
    data: null,
    message: '用戶未有 active routine'
  };
});
