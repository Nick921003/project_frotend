import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
import { serverSupabaseClient } from '#supabase/server';

/**
 * PUT /api/routines/[id]/meta
 * 更新排程名稱與描述
 */
export default defineEventHandler(async (event) => {
  const routineId = getRouterParam(event, 'id');

  if (!routineId) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少必要參數：routineId'
    });
  }

  const { role } = await assertRoutineAccess(event, routineId, 'edit');

  const body = await readBody(event);
  const name = String(body?.name || '').trim();
  const description = String(body?.description || '').trim();

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '排程名稱不可為空' });
  }

  if (name.length > 60) {
    throw createError({ statusCode: 400, statusMessage: '排程名稱請限制在 60 字內' });
  }

  const userClient = await serverSupabaseClient(event);
  const supabase = role === 'owner' ? userClient : getServiceClient(event);

  const { data, error } = await (supabase as any)
    .from('routines')
    .update({
      name,
      description: description || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', routineId)
    .select('id, name, description')
    .single();

  if (error || !data) {
    throw createError({
      statusCode: error?.code === 'PGRST116' ? 404 : 500,
      statusMessage: error?.message || '更新排程資料失敗'
    });
  }

  return {
    success: true,
    message: '排程名稱已更新',
    data
  };
});
