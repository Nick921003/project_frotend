import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
import { serverSupabaseClient } from '#supabase/server';

/**
 * DELETE /api/routines/[id]
 * 刪除排程（僅擁有者）。routine_shares / user_active_routine 由 FK 連動清理。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');

	// 僅擁有者
	await assertRoutineAccess(event, routineId, 'owner');
	const supabase = await serverSupabaseClient(event);

	// 先刪項目
	const { error: deleteItemsError } = await (supabase as any)
		.from('routine_items')
		.delete()
		.eq('routine_id', routineId);
	if (deleteItemsError) {
		throw createError({ statusCode: 500, statusMessage: '刪除排程項目失敗: ' + deleteItemsError.message });
	}

	// 再刪排程本身（routine_shares ON DELETE CASCADE、user_active_routine ON DELETE SET NULL 連動）
	const { error: deleteError } = await (supabase as any)
		.from('routines')
		.delete()
		.eq('id', routineId);
	if (deleteError) {
		throw createError({ statusCode: 500, statusMessage: '刪除排程失敗: ' + deleteError.message });
	}

	return { success: true, message: '排程已刪除' };
});
