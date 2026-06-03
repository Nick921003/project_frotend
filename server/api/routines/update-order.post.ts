import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';
import { serverSupabaseClient } from '#supabase/server';

/**
 * POST /api/routines/update-order
 * 三向同步排程項目（更新/插入/刪除）。支援編輯權協作者。
 * routine_items.user_id 一律寫 ownerId，維持單一歸屬。
 */
export default defineEventHandler(async (event) => {
	const body = await readBody(event);
	const { routine_id, updates } = body || {};
	if (!routine_id || !Array.isArray(updates)) {
		throw createError({ statusCode: 400, statusMessage: '缺少必要欄位：routine_id 或 updates' });
	}

	// 需 edit 權
	const { ownerId, role } = await assertRoutineAccess(event, routine_id, 'edit');
	const userClient = await serverSupabaseClient(event);
	const supabase = role === 'owner' ? userClient : getServiceClient(event);

	// 現有項目（以 ownerId 為歸屬，避免協作者歸屬錯誤）
	const { data: existingItems, error: fetchError } = await (supabase as any)
		.from('routine_items')
		.select('*')
		.eq('routine_id', routine_id)
		.eq('user_id', ownerId);
	if (fetchError) {
		throw createError({ statusCode: 500, statusMessage: '讀取現有項目失敗: ' + fetchError.message });
	}

	const existingItemsMap = new Map((existingItems || []).map((item: any) => [item.id, item]));
	const frontendItemIds = new Set(updates.filter((u: any) => u.id).map((u: any) => u.id));

	let updatedCount = 0, insertedCount = 0, deletedCount = 0;
	const errors: string[] = [];

	const itemsToUpdate = updates.filter((u: any) => u.id);
	const itemsToInsert = updates.filter((u: any) => !u.id);
	const itemsToDelete = (existingItems || []).filter((item: any) => !frontendItemIds.has(item.id));

	// 更新
	for (const update of itemsToUpdate) {
		const { id, day_of_week, time_of_day, sequence_order, product_name, product_category, ingredients, is_recommendation, is_locked, recommendation_reason, notes, product_id } = update;
		if (!id || day_of_week === undefined || !time_of_day) {
			errors.push(`無效的更新項目：${JSON.stringify(update)}`); continue;
		}
		if (!existingItemsMap.has(id)) {
			errors.push(`項目 ${id} 不屬於此規劃`); continue;
		}
		const { error: updateError } = await (supabase as any)
			.from('routine_items')
			.update({
				day_of_week, time_of_day, sequence_order, product_name, product_category,
				product_id: product_id ?? null,
				ingredients: ingredients || [],
				is_recommendation: is_recommendation || false,
				is_locked: is_locked === true,
				recommendation_reason: recommendation_reason || null,
				notes: notes || null,
				updated_at: new Date().toISOString()
			})
			.eq('id', id);
		if (updateError) errors.push(`更新項目 ${id} 失敗: ${updateError.message}`);
		else updatedCount++;
	}

	// 插入（user_id 一律 ownerId，非協作者）
	if (itemsToInsert.length > 0) {
		const itemsForInsert = itemsToInsert.map((item: any) => ({
			routine_id,
			user_id: ownerId,
			product_name: item.product_name,
			product_category: item.product_category,
			product_id: item.product_id ?? null,
			day_of_week: item.day_of_week,
			time_of_day: item.time_of_day,
			sequence_order: item.sequence_order,
			ingredients: item.ingredients || [],
			is_recommendation: item.is_recommendation || false,
			is_locked: item.is_locked === true,
			recommendation_reason: item.recommendation_reason || null,
			notes: item.notes || null
		}));
		const { data: insertData, error: insertError } = await (supabase as any)
			.from('routine_items').insert(itemsForInsert).select();
		if (insertError) errors.push(`批量插入新項目失敗: ${insertError.message}`);
		else if (insertData) insertedCount = insertData.length;
	}

	// 刪除
	if (itemsToDelete.length > 0) {
		const idsToDelete = itemsToDelete.map((item: any) => item.id);
		const { error: deleteError } = await (supabase as any)
			.from('routine_items').delete().in('id', idsToDelete);
		if (deleteError) errors.push(`批量刪除項目失敗: ${deleteError.message}`);
		else deletedCount = itemsToDelete.length;
	}

	const allSuccess = errors.length === 0;
	return {
		success: allSuccess,
		data: {
			updated_count: updatedCount, inserted_count: insertedCount, deleted_count: deletedCount,
			failed_count: errors.length, errors: errors.length > 0 ? errors : undefined
		},
		message: allSuccess
			? `成功同步：更新 ${updatedCount} 個、插入 ${insertedCount} 個、刪除 ${deletedCount} 個項目`
			: `部分操作失敗：更新 ${updatedCount}、插入 ${insertedCount}、刪除 ${deletedCount}、失敗 ${errors.length}`
	};
});
