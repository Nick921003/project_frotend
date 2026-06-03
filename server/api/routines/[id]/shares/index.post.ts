import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * POST /api/routines/[id]/shares
 * body: { target_user_id, permission: 'view'|'edit' }
 * 新增/更新分享（upsert by routine_id+user_id，status 設 active）。僅擁有者。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const { ownerId } = await assertRoutineAccess(event, routineId, 'owner');

	const body = await readBody(event);
	const targetUserId = String(body?.target_user_id || '');
	const permission = body?.permission === 'edit' ? 'edit' : 'view';

	if (!targetUserId) throw createError({ statusCode: 400, statusMessage: '缺少 target_user_id' });
	if (targetUserId === ownerId) throw createError({ statusCode: 400, statusMessage: '不可分享給自己' });

	const admin = getServiceClient(event);
	const { data, error } = await (admin as any)
		.from('routine_shares')
		.upsert(
			{
				routine_id: routineId,
				user_id: targetUserId,
				shared_by: ownerId,
				permission,
				status: 'active',
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'routine_id,user_id' }
		)
		.select('id, user_id, permission, status')
		.single();
	if (error) throw createError({ statusCode: 500, statusMessage: '新增分享失敗: ' + error.message });

	return { success: true, data, message: '已分享' };
});
