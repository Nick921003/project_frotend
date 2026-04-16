import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

/**
 * GET /api/routines/list
 * 取得使用者的所有保養排程
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

  // 從 routines 表查詢該用戶的排程
  // 假設 routines 表有: id, user_id, name, description, created_by_ai, is_active, created_at, updated_at
  const { data, error } = await (supabase as any)
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Routines List Error]:', error);
    throw createError({
      statusCode: 500,
      statusMessage: '查詢排程列表失敗: ' + error.message
    });
  }

  return {
    success: true,
    data: data || []
  };
});
