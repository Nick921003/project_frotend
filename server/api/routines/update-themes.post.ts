import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
import { serverSupabaseClient } from '#supabase/server';

/**
 * POST /api/routines/update-themes
 * 保存排程的主題/類型設定
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { routine_id, themes = [], custom_themes = [] } = body;

    if (!routine_id) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少必要參數：routine_id'
      });
    }

    const { role } = await assertRoutineAccess(event, routine_id, 'edit');
    const userClient = await serverSupabaseClient(event);
    const supabase = role === 'owner' ? userClient : getServiceClient(event);

    // 保存主題設定
    const { error: updateError } = await (supabase as any)
      .from('routines')
      .update({ themes, custom_themes })
      .eq('id', routine_id);

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
