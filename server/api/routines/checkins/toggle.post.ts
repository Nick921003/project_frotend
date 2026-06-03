import { serverSupabaseClient } from '#supabase/server';
import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

export default defineEventHandler(async (event) => {
	const { routine_item_id, checked_date } = await readBody(event);
	if (!routine_item_id || !checked_date) {
		throw createError({ statusCode: 400, statusMessage: '缺少 routine_item_id 或 checked_date' });
	}

	// 反查 item 所屬 routine（service key）
	const admin = getServiceClient(event);
	const { data: item, error: itemError } = await (admin as any)
		.from('routine_items')
		.select('routine_id')
		.eq('id', routine_item_id)
		.single();
	if (itemError || !item) {
		throw createError({ statusCode: 404, statusMessage: '找不到此排程項目' });
	}

	// 至少 view 權才能打卡
	const { userId } = await assertRoutineAccess(event, item.routine_id, 'view');

	// 打卡是自己的：user client
	const supabase = await serverSupabaseClient(event);
	const { data: existing } = await (supabase as any)
		.from('routine_checkins')
		.select('id')
		.eq('routine_item_id', routine_item_id)
		.eq('checked_date', checked_date)
		.eq('user_id', userId)
		.maybeSingle();

	if (existing) {
		await (supabase as any).from('routine_checkins').delete().eq('id', existing.id);
		return { success: true, checked: false };
	} else {
		await (supabase as any).from('routine_checkins').insert({ user_id: userId, routine_item_id, checked_date });
		return { success: true, checked: true };
	}
});
