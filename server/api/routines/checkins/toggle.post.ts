import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = user.id || user.sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

	const { routine_item_id, checked_date } = await readBody(event);
	if (!routine_item_id || !checked_date) {
		throw createError({ statusCode: 400, statusMessage: '缺少 routine_item_id 或 checked_date' });
	}

	const supabase = await serverSupabaseClient(event);

	const { data: existing } = await (supabase as any)
		.from('routine_checkins')
		.select('id')
		.eq('routine_item_id', routine_item_id)
		.eq('checked_date', checked_date)
		.eq('user_id', userId)
		.maybeSingle();

	if (existing) {
		await (supabase as any)
			.from('routine_checkins')
			.delete()
			.eq('id', existing.id);
		return { success: true, checked: false };
	} else {
		await (supabase as any)
			.from('routine_checkins')
			.insert({ user_id: userId, routine_item_id, checked_date });
		return { success: true, checked: true };
	}
});
