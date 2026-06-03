import { serverSupabaseClient } from '#supabase/server';
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const access = await assertRoutineAccess(event, routineId, 'view');
	const { userId, role } = access;

	const query = getQuery(event);
	const rawDate = query.date;
	const date = typeof rawDate === 'string' ? rawDate : new Date().toISOString().slice(0, 10);

	// 自己的打卡：user client（RLS auth.uid()=user_id）
	const supabase = await serverSupabaseClient(event);

	// item ids：若是 owner 優先用原本 user client，防 service key 不合法被 RLS 擋
	const dbClient = role === 'owner' ? supabase : getServiceClient(event);
	const { data: itemRows, error: itemsError } = await (dbClient as any)
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
