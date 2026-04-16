import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

/**
 * POST /api/routines/update-themes
 * 保存排程的主題/類型設定
 */
export default defineEventHandler(async (event) => {
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
    const { routine_id, themes = [], custom_themes = [] } = body;

    if (!routine_id) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少必要參數：routine_id'
      });
    }

    const supabase = await serverSupabaseClient(event);

    // 驗證排程屬於當前用戶
    const { data: routine, error: checkError } = await supabase
      .from('routines')
      .select('id')
      .eq('id', routine_id)
      .eq('user_id', userId)
      .single();

    if (checkError || !routine) {
      throw createError({
        statusCode: 403,
        statusMessage: '無權修改此排程'
      });
    }

    // 保存主題設定
    // 注意：確保 routines 表中有 themes 和 custom_themes 字段
    const { error: updateError } = await supabase
      .from('routines')
      .update({ 
        themes,
        custom_themes
      })
      .eq('id', routine_id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Update Themes Error]:', updateError);
      throw createError({
        statusCode: 500,
        statusMessage: updateError.message || '保存主題失敗'
      });
    }

    return {
      success: true,
      message: '主題設定已保存',
      data: {
        themes,
        custom_themes
      }
    };
  } catch (error: any) {
    console.error('[Save Themes API Error]:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || '保存主題失敗'
    });
  }
});
