import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

/**
 * DELETE /api/routines/[id]
 * 刪除排程
 */
export default defineEventHandler(async (event) => {
  const routineId = getRouterParam(event, 'id');
  
  if (!routineId) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少必要參數：routineId'
    });
  }

  try {
    const user = await serverSupabaseUser(event);
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: '需要登錄'
      });
    }

    const userId = user.id || user.sub;
    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: '無法識別用戶身份'
      });
    }

    const supabase = await serverSupabaseClient(event);

    console.log('[DELETE] 開始刪除排程:', { routineId, userId });

    // 驗證 routineId 是有效的 UUID
    if (!routineId || typeof routineId !== 'string' || routineId.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '無效的排程 ID'
      });
    }

    // 第一步：先驗證排程屬於當前使用者
    const { data: routine, error: routineError } = await supabase
      .from('routines')
      .select('id')
      .eq('id', routineId)
      .eq('user_id', userId)
      .single();

    if (routineError || !routine) {
      throw createError({
        statusCode: routineError?.code === 'PGRST116' ? 404 : 403,
        statusMessage: '找不到排程或無權限刪除'
      });
    }

    // 第二步：刪除排程中的所有項目 (routine_items)
    console.log('[DELETE] 刪除對應的排程項目...');
    const { error: deleteItemsError } = await supabase
      .from('routine_items')
      .delete()
      .eq('routine_id', routineId)
      .eq('user_id', userId);

    if (deleteItemsError) {
      console.error('[DELETE Routine Items Error]:', deleteItemsError);
      throw createError({
        statusCode: 500,
        statusMessage: '刪除排程項目失敗: ' + deleteItemsError.message
      });
    }

    console.log('[DELETE] 已刪除排程項目');

    // 第三步：刪除排程本身
    console.log('[DELETE] 刪除排程記錄...');
    const { error: deleteError } = await supabase
      .from('routines')
      .delete()
      .eq('id', routineId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[DELETE Routine Error]:', deleteError);
      throw createError({
        statusCode: 500,
        statusMessage: '刪除排程失敗: ' + deleteError.message
      });
    }

    console.log('[DELETE] 排程已成功刪除');

    return {
      success: true,
      message: '排程已刪除'
    };
  } catch (error: any) {
    console.error('[API Error]:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || '刪除失敗'
    });
  }
});
