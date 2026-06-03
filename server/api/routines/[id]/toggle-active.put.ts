import { serverSupabaseClient } from '#supabase/server';
import { assertRoutineAccess } from '~/server/utils/routineAccess';

/**
 * PUT /api/routines/[id]/toggle-active
 * 設定/取消「當前登入者」的每日視圖啟動排程（per-user）。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const body = await readBody(event);
	const { is_active } = body || {};

	if (typeof is_active !== 'boolean') {
		throw createError({ statusCode: 400, statusMessage: '無效的參數：is_active 必須是布林值' });
	}

	// 需至少 view 權限才能把它設為自己的啟動排程
	const { userId } = await assertRoutineAccess(event, routineId, 'view');

	// user_active_routine 是自己那列，RLS auth.uid()=user_id，續用 user client
	const supabase = await serverSupabaseClient(event);

	if (is_active) {
		const { error } = await (supabase as any)
			.from('user_active_routine')
			.upsert(
				{ user_id: userId, routine_id: routineId, updated_at: new Date().toISOString() },
				{ onConflict: 'user_id' }
			);
		if (error) throw createError({ statusCode: 500, statusMessage: '更新啟動狀態失敗: ' + error.message });
	} else {
		// 只在當前啟動的就是這份時才清掉
		const { data: updated, error } = await (supabase as any)
			.from('user_active_routine')
			.update({ routine_id: null, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('routine_id', routineId)
			.select('user_id');
		if (error) throw createError({ statusCode: 500, statusMessage: '更新啟動狀態失敗: ' + error.message });
		const changed = Array.isArray(updated) && updated.length > 0;
		return { success: true, changed, message: changed ? '排程已停用' : '排程本已未啟動' };
	}

	return { success: true, message: '排程已啟用' };
});
