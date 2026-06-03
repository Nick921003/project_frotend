import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { getServiceClient, assertRoutineAccess } from '~/server/utils/routineAccess';

/**
 * GET /api/routines/active
 * 取得「當前登入者」啟動的排程（可能是自己的或共享的），含完整項目。
 */
export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

	const supabase = await serverSupabaseClient(event);

	// 讀自己的啟動指標（user client，RLS 自己那列）
	const { data: activeRow } = await (supabase as any)
		.from('user_active_routine')
		.select('routine_id')
		.eq('user_id', userId)
		.maybeSingle();

	const routineId = activeRow?.routine_id;
	if (!routineId) {
		return { success: true, data: null, message: '用戶未有 active routine' };
	}

	// 防呆：指向的排程可能已被刪或分享被暫停 → 清掉並回 null
	// 僅 404/403 才清除（5xx/網路錯誤不視為 dangling，避免誤刪啟動狀態）
	try {
		await assertRoutineAccess(event, routineId, 'view');
	} catch (err: any) {
		const status = err?.statusCode ?? err?.status;
		if (status === 404 || status === 403) {
			await (supabase as any)
				.from('user_active_routine')
				.update({ routine_id: null, updated_at: new Date().toISOString() })
				.eq('user_id', userId);
			return { success: true, data: null, message: '啟動排程已失效' };
		}
		throw err;
	}

	// 以 service key 載入（可能是他人擁有的共享排程）
	const admin = getServiceClient(event);
	const { data: routineData, error: routineError } = await (admin as any)
		.from('routines')
		.select('*')
		.eq('id', routineId)
		.single();
	if (routineError || !routineData) {
		return { success: true, data: null, message: '啟動排程不存在' };
	}

	const { data: itemsData, error: itemsError } = await (admin as any)
		.from('routine_items')
		.select('*')
		.eq('routine_id', routineId)
		.order('day_of_week')
		.order('time_of_day')
		.order('sequence_order');
	if (itemsError) {
		throw createError({ statusCode: 500, statusMessage: '查詢排程項目失敗: ' + itemsError.message });
	}

	return {
		success: true,
		data: { ...routineData, items: itemsData || [] },
		message: '成功取得 active routine'
	};
});
