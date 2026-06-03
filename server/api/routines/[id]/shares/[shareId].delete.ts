import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * DELETE /api/routines/[id]/shares/[shareId]
 * 移除分享（僅擁有者）。順手清該協作者指向此排程的啟動指標。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const shareId = getRouterParam(event, 'shareId');
	await assertRoutineAccess(event, routineId, 'owner');

	const admin = getServiceClient(event);

	// 先取得 user_id 供清理
	const { data: share } = await (admin as any)
		.from('routine_shares')
		.select('user_id')
		.eq('id', shareId)
		.eq('routine_id', routineId)
		.maybeSingle();

	const { error } = await (admin as any)
		.from('routine_shares')
		.delete()
		.eq('id', shareId)
		.eq('routine_id', routineId);
	if (error) throw createError({ statusCode: 500, statusMessage: '移除分享失敗: ' + error.message });

	if (share?.user_id) {
		await (admin as any)
			.from('user_active_routine')
			.update({ routine_id: null, updated_at: new Date().toISOString() })
			.eq('user_id', share.user_id)
			.eq('routine_id', routineId);
	}

	return { success: true, message: '已移除分享' };
});
