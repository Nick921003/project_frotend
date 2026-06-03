import { assertRoutineAccess, getServiceClient } from '~/server/utils/routineAccess';

/**
 * DELETE /api/routines/[id]/shares/[shareId]
 * 移除分享（僅擁有者）。順手清該協作者指向此排程的啟動指標。
 * 同步實現方案 B：將協作者在排程中使用的獨有保養品，複製到擁有者的化妝檯。
 */
export default defineEventHandler(async (event) => {
	const routineId = getRouterParam(event, 'id');
	const shareId = getRouterParam(event, 'shareId');
	const access = await assertRoutineAccess(event, routineId, 'owner');
	const ownerId = access.userId; // 擁有者 ID

	const admin = getServiceClient(event);

	// 1. 先取得被移除協作者的 user_id 供後續同步與清理
	const { data: share } = await (admin as any)
		.from('routine_shares')
		.select('user_id')
		.eq('id', shareId)
		.eq('routine_id', routineId)
		.maybeSingle();

	if (share?.user_id) {
		const collaboratorId = share.user_id;

		try {
			// 2. 方案 B 同步：找出此排程的排程步驟中，有關聯產品的所有 items
			const { data: items } = await (admin as any)
				.from('routine_items')
				.select('product_id')
				.eq('routine_id', routineId)
				.not('product_id', 'is', null);

			if (items && items.length > 0) {
				const uniqueProductIds = Array.from(new Set(items.map((i: any) => i.product_id)));

				if (uniqueProductIds.length > 0) {
					// 3. 找出其中屬於被移除協作者的產品詳細資料
					const { data: collaboratorProducts } = await (admin as any)
						.from('user_cabinet')
						.select('*')
						.in('id', uniqueProductIds)
						.eq('user_id', collaboratorId);

					if (collaboratorProducts && collaboratorProducts.length > 0) {
						// 4. 將這些產品複製一份到擁有者 (ownerId) 的保養品櫃中
						for (const prod of collaboratorProducts) {
							// 排除原有 ID，準備插入新資料
							const { id: oldProdId, ...prodData } = prod;

							// 建立複製品，重新將擁有者設為 ownerId
							const copyData = {
								...prodData,
								user_id: ownerId,
								created_at: new Date().toISOString(),
								// 重設使用狀態，僅複製產品基本資料與分析結果，不複製他人的歷史使用資訊
								opened_at: null,
								expires_at: null
							};

							const { data: newProd, error: insertError } = await (admin as any)
								.from('user_cabinet')
								.insert(copyData)
								.select('id')
								.single();

							if (!insertError && newProd) {
								// 5. 將排程步驟中引用協作者的 oldProdId，更新為擁有者自己剛建立的 newProd.id
								await (admin as any)
									.from('routine_items')
									.update({ product_id: newProd.id })
									.eq('routine_id', routineId)
									.eq('product_id', oldProdId);
							} else {
								console.warn('[Sync on Revoke] 產品同步複製失敗:', insertError?.message);
							}
						}
					}
				}
			}
		} catch (syncError: any) {
			// 即使同步發生錯誤，我們也只在 log 警告，避免阻擋移除分享的主體流程
			console.error('[Sync on Revoke] 停止分享同步產品時發生錯誤:', syncError.message);
		}

		// 6. 清理該協作者的 active 指標
		await (admin as any)
			.from('user_active_routine')
			.update({ routine_id: null, updated_at: new Date().toISOString() })
			.eq('user_id', collaboratorId)
			.eq('routine_id', routineId);
	}

	// 7. 刪除分享紀錄
	const { error } = await (admin as any)
		.from('routine_shares')
		.delete()
		.eq('id', shareId)
		.eq('routine_id', routineId);
	if (error) throw createError({ statusCode: 500, statusMessage: '移除分享失敗: ' + error.message });

	return { success: true, message: '已移除分享，且已自動收回同步協作者專屬保養品' };
});
