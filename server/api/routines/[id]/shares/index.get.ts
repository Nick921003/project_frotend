import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
import { getUserEmails } from '~/server/utils/userEmails';

/**
 * GET /api/routines/[id]/shares
 * 列出此排程所有分享對象（僅擁有者）。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	await assertRoutineAccess(event, routineId, 'owner');

	const admin = getServiceClient(event);
	const { data: shares, error } = await (admin as any)
		.from('routine_shares')
		.select('id, user_id, permission, status, created_at')
		.eq('routine_id', routineId)
		.order('created_at', { ascending: true });
	if (error) throw createError({ statusCode: 500, statusMessage: '查詢分享列表失敗: ' + error.message });

	const emailMap = await getUserEmails(admin, (shares || []).map((s: any) => s.user_id));
	const data = (shares || []).map((s: any) => ({
		id: s.id,
		user_id: s.user_id,
		email: emailMap[s.user_id] || '',
		permission: s.permission,
		status: s.status
	}));
	return { success: true, data };
});
