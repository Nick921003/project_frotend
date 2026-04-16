import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

/**
 * PATCH /api/routines/items/[id]/lock
 * 切換單一排程項目的鎖定狀態
 */
export default defineEventHandler(async (event) => {
  const itemId = getRouterParam(event, 'id');
  if (!itemId) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少必要參數：itemId'
    });
  }

  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '需要登入'
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
  const { is_locked } = body || {};

  if (typeof is_locked !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'is_locked 必須是布林值'
    });
  }

  const supabase = await serverSupabaseClient(event);

  const { data: item, error: itemError } = await supabase
    .from('routine_items')
    .select('id')
    .eq('id', itemId)
    .eq('user_id', userId)
    .single();

  if (itemError || !item) {
    throw createError({
      statusCode: 404,
      statusMessage: '找不到此排程項目或無權限修改'
    });
  }

  const { error: updateError } = await supabase
    .from('routine_items')
    .update({ is_locked })
    .eq('id', itemId)
    .eq('user_id', userId);

  if (updateError) {
    throw createError({
      statusCode: 500,
      statusMessage: '更新鎖定狀態失敗: ' + updateError.message
    });
  }

  return {
    success: true,
    data: {
      id: itemId,
      is_locked
    },
    message: is_locked ? '項目已鎖定' : '項目已解鎖'
  };
});