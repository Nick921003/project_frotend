import { detectConflicts } from '~/server/utils/ingredientConflicts';
import { getServiceClient, assertRoutineAccess } from '~/server/utils/routineAccess';
import { serverSupabaseClient } from '#supabase/server';

/**
 * GET /api/routines/:id
 * 取得完整排程（含項目、衝突、可選產品）。支援擁有者與共享協作者。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');

	// 授權（view）；回傳含 ownerId / permission
	const access = await assertRoutineAccess(event, routineId, 'view');
	const { ownerId, userId, role, permission } = access;

	// 若是 owner，優先使用使用者的帶 cookie/token RLS client；以保證當 Secret Key 填寫錯誤時，擁有者的排程依舊能完整讀取。
	const userClient = await serverSupabaseClient(event);
	const admin = role === 'owner' ? userClient : getServiceClient(event);

	const { data: routineData, error: routineError } = await (admin as any)
		.from('routines')
		.select('*')
		.eq('id', routineId)
		.single();
	if (routineError || !routineData) {
		throw createError({ statusCode: 404, statusMessage: '排程不存在' });
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

	// orphan 基準：owner 櫃 ∪ 當前檢視者櫃（檢視者剛從自己櫃加的不被誤標）
	const cabinetOwnerIds = Array.from(new Set([ownerId, userId]));
	const { data: productsData } = await (admin as any)
		.from('user_cabinet')
		.select('*')
		.in('user_id', cabinetOwnerIds);

	const existingProductIds = new Set<string>(
		(productsData || []).map((p: any) => p.id).filter(Boolean)
	);
	const itemsWithOrphan = (itemsData || []).map((item: any) => ({
		...item,
		is_orphan: item.product_id != null && !existingProductIds.has(item.product_id)
	}));

	// 成分衝突（優先用 item.ingredients；缺則回查櫃）
	const productIngredientMap = new Map<string, string>();
	for (const p of (productsData || [])) {
		if (p.id && p.raw_ingredients) productIngredientMap.set(p.id, String(p.raw_ingredients).toLowerCase());
	}
	const conflictsByDay: Record<number, { rule: string; message: string }[]> = {};
	for (let day = 0; day < 7; day++) {
		const dayItems = itemsWithOrphan.filter((i: any) => i.day_of_week === day);
		const allIngredients = dayItems
			.map((i: any) => {
				if (Array.isArray(i.ingredients) && i.ingredients.length > 0) return i.ingredients as string[];
				if (i.product_id && productIngredientMap.has(i.product_id)) return [productIngredientMap.get(i.product_id)!];
				return [] as string[];
			})
			.filter((arr: string[]) => arr.length > 0);
		const warnings = detectConflicts(allIngredients);
		if (warnings.length > 0) conflictsByDay[day] = warnings;
	}

	// 「新增產品」挑選清單：用檢視者自己的櫃（只能加自己有的）
	const viewerProducts = (productsData || []).filter((p: any) => p.user_id === userId);

	return {
		success: true,
		data: {
			...routineData,
			items: itemsWithOrphan,
			conflicts_by_day: conflictsByDay,
			all_products: viewerProducts.map((p: any) => ({
				id: p.id,
				product_name: p.product_name,
				product_category: p.product_category,
				raw_ingredients: p.raw_ingredients || '',
				analysis_result: p.analysis_result || null,
				is_recommendation: p.is_recommendation ?? false
			})),
			_access: { role, permission, owner_id: ownerId }
		},
		message: '成功取得排程'
	};
});
