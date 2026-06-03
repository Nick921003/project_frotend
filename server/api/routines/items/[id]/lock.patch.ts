import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
import { serverSupabaseClient } from '#supabase/server';

/**
 * PATCH /api/routines/items/[id]/lock
 * 切換單一項目鎖定。由 item 反查所屬 routine 後驗 edit 權。
 */
export default defineEventHandler(async (event) => {
	const itemId = getRouterParam(event, 'id');
	if (!itemId) throw createError({ statusCode: 400, statusMessage: '缺少必要參數：itemId' });

	const body = await readBody(event);
	const { is_locked } = body || {};
	if (typeof is_locked !== 'boolean') {
		throw createError({ statusCode: 400, statusMessage: 'is_locked 必須是布林值' });
	}

	const userClient = await serverSupabaseClient(event);
	let item = null;
	let itemError = null;

	try {
		const { data, error } = await (userClient as any)
			.from('routine_items')
			.select('id, routine_id')
			.eq('id', itemId)
			.single();
		item = data;
		itemError = error;
	} catch (inner) {}

	if (!item) {
		// 可能是他人共享的項目，走 admin 查
		const admin = getServiceClient(event);
		const { data, error } = await (admin as any)
			.from('routine_items')
			.select('id, routine_id')
			.eq('id', itemId)
			.single();
		item = data;
		itemError = error;
	}

	if (itemError || !item) {
		throw createError({ statusCode: 404, statusMessage: '找不到此排程項目' });
	}

	// 驗 edit 權
	const { role } = await assertRoutineAccess(event, item.routine_id, 'edit');
	const dbClient = role === 'owner' ? userClient : getServiceClient(event);

	const { error: updateError } = await (dbClient as any)
		.from('routine_items')
		.update({ is_locked })
		.eq('id', itemId);
	if (updateError) {
		throw createError({ statusCode: 500, statusMessage: '更新鎖定狀態失敗: ' + updateError.message });
	}

	return { success: true, data: { id: itemId, is_locked }, message: is_locked ? '項目已鎖定' : '項目已解鎖' };
});
