import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * PATCH /api/routines/[id]/shares/[shareId]
 * body: { permission?, status? }。僅擁有者。
 * status 改 paused 時，順手清掉該協作者指向此排程的啟動指標。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const shareId = getRouterParam(event, 'shareId');
	await assertRoutineAccess(event, routineId, 'owner');

	const body = await readBody(event);
	const patch: Record<string, any> = { updated_at: new Date().toISOString() };
	if (body?.permission === 'view' || body?.permission === 'edit') patch.permission = body.permission;
	if (body?.status === 'active' || body?.status === 'paused') patch.status = body.status;
	if (patch.permission === undefined && patch.status === undefined) {
		throw createError({ statusCode: 400, statusMessage: '無可更新欄位' });
	}

	const admin = getServiceClient(event);
	const { data: updated, error } = await (admin as any)
		.from('routine_shares')
		.update(patch)
		.eq('id', shareId)
		.eq('routine_id', routineId)
		.select('id, user_id, permission, status')
		.single();
	if (error || !updated) throw createError({ statusCode: 404, statusMessage: '找不到分享紀錄或更新失敗' });

	// 暫停時：清掉該協作者指向此排程的每日啟動
	if (patch.status === 'paused') {
		await (admin as any)
			.from('user_active_routine')
			.update({ routine_id: null, updated_at: new Date().toISOString() })
			.eq('user_id', updated.user_id)
			.eq('routine_id', routineId);
	}

	return { success: true, data: updated, message: '已更新分享設定' };
});
