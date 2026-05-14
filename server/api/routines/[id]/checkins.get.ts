import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = user.id || user.sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

	const routineId = getRouterParam(event, 'id');
	const query = getQuery(event);
	const rawDate = query.date;
	const date = typeof rawDate === 'string' ? rawDate : new Date().toISOString().slice(0, 10);

	const supabase = await serverSupabaseClient(event);

	// Step A：先取出此 routine 的所有 item ids
	const { data: itemRows, error: itemsError } = await (supabase as any)
		.from('routine_items')
		.select('id')
		.eq('routine_id', routineId);

	if (itemsError) {
		throw createError({ statusCode: 500, statusMessage: '查詢排程項目失敗: ' + itemsError.message });
	}

	const itemIds = (itemRows || []).map((i: any) => i.id);
	if (itemIds.length === 0) {
		return { success: true, data: { checked_ids: [], date } };
	}

	// Step B：查詢今天這些 items 的打卡記錄
	const { data: checkins, error: checkinsError } = await (supabase as any)
		.from('routine_checkins')
		.select('routine_item_id')
		.eq('user_id', userId)
		.eq('checked_date', date)
		.in('routine_item_id', itemIds);

	if (checkinsError) {
		throw createError({ statusCode: 500, statusMessage: '查詢打卡記錄失敗: ' + checkinsError.message });
	}

	const checkedIds = (checkins || []).map((c: any) => c.routine_item_id);
	return { success: true, data: { checked_ids: checkedIds, date } };
});
