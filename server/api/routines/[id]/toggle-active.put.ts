import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

/**
 * PUT /api/routines/[id]/toggle-active
 * 啟用或停用排程
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

    const body = await readBody(event);
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      throw createError({
        statusCode: 400,
        statusMessage: '無效的參數：is_active 必須是布林值'
      });
    }

    const supabase = await serverSupabaseClient(event);

    // 更新排程的 is_active 狀態
    // RLS 會自動過濾使用者，如果排程不屬於當前用戶會失敗
    const { error: updateError } = await supabase
      .from('routines')
      .update({ is_active })
      .eq('id', routineId)
      .eq('user_id', userId);  // RLS 會強制此條件

    if (updateError) {
      console.error('[Toggle Active Error]:', updateError);
      throw createError({
        statusCode: 500,
        statusMessage: '更新排程狀態失敗: ' + updateError.message
      });
    }

    return {
      success: true,
      message: `排程已${is_active ? '啟用' : '停用'}`
    };
  } catch (error: any) {
    console.error('[Toggle Active Error]:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || '操作失敗'
    });
  }
});
