import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

/**
 * POST /api/routines/update-order
 * 
 * 同步排程項目到數據庫（三向同步：更新、插入、刪除）
 * 前端發送完整的排程項目列表，API 自動進行對比：
 * - 有 id 的項目：執行更新或刪除
 * - 無 id 的項目：執行插入
 * - 數據庫中有但前端無 id 且未在前端：執行刪除
 * 
 * Request body:
 * {
 *   routine_id: string (UUID),
 *   updates: Array<{
 *     id?: string (UUID) - 可選，如果沒有表示新項目,
 *     product_name: string,
 *     product_category: string,
 *     day_of_week: number (0-6),
 *     time_of_day: 'morning' | 'evening',
 *     sequence_order: number,
 *     ingredients?: string[],
 *     is_recommendation?: boolean,
 *     recommendation_reason?: string,
 *     notes?: string
 *   }>
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     updated_count: number,
 *     inserted_count: number,
 *     deleted_count: number
 *   },
 *   message: string
 * }
 */
export default defineEventHandler(async (event) => {
  // ==================
  // 1. 驗證使用者
  // ==================
  const user = await serverSupabaseUser(event);

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入' });
  }

  const userId = user.id || user.sub;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  // ==================
  // 2. 取得請求 body
  // ==================
  const body = await readBody(event);
  const { routine_id, updates } = body;

  if (!routine_id || !Array.isArray(updates)) {
    throw createError({
      statusCode: 400,
      statusMessage: '缺少必要欄位：routine_id 或 updates'
    });
  }

  // ==================
  // 3. 取得 Supabase 客戶端
  // ==================
  const supabase = await serverSupabaseClient(event);

  // ==================
  // 4. 驗證該 routine 屬於該使用者
  // ==================
  const { data: routineData, error: routineError } = (await (supabase as any)
    .from('routines')
    .select('id, user_id')
    .eq('id', routine_id)
    .eq('user_id', userId)
    .single()) as any;

  if (routineError || !routineData) {
    throw createError({
      statusCode: 403,
      statusMessage: '無權限更新此規劃'
    });
  }

  // ==================
  // 5. 取得該 routine 現有的所有項目
  // ==================
  const { data: existingItems, error: fetchError } = (await (supabase as any)
    .from('routine_items')
    .select('*')
    .eq('routine_id', routine_id)
    .eq('user_id', userId)) as any;

  if (fetchError) {
    throw createError({
      statusCode: 500,
      statusMessage: '讀取現有項目失敗: ' + fetchError.message
    });
  }

  const existingItemsMap = new Map((existingItems || []).map((item: any) => [item.id, item]));
  const frontendItemIds = new Set(updates.filter((u: any) => u.id).map((u: any) => u.id));

  // ==================
  // 6. 準備三種操作的項目集合
  // ==================
  let updatedCount = 0;
  let insertedCount = 0;
  let deletedCount = 0;
  const errors: string[] = [];

  const itemsToUpdate = updates.filter((u: any) => u.id); // 有 id 的項目
  const itemsToInsert = updates.filter((u: any) => !u.id); // 沒有 id 的新項目
  const itemsToDelete = (existingItems || []).filter((item: any) => !frontendItemIds.has(item.id)); // 要刪除的項目

  // ==================
  // 7. 批量更新現有項目
  // ==================
  for (const update of itemsToUpdate) {
    const { id, day_of_week, time_of_day, sequence_order, product_name, product_category, ingredients, is_recommendation, is_locked, recommendation_reason, notes } = update;

    if (!id || day_of_week === undefined || !time_of_day) {
      errors.push(`無效的更新項目：${JSON.stringify(update)}`);
      continue;
    }

    // 驗證該項目屬於該 routine
    if (!existingItemsMap.has(id)) {
      errors.push(`項目 ${id} 不屬於此規劃`);
      continue;
    }

    // 執行更新
    const { error: updateError } = (await (supabase as any)
      .from('routine_items')
      .update({
        day_of_week,
        time_of_day,
        sequence_order,
        product_name,
        product_category,
        ingredients: ingredients || [],
        is_recommendation: is_recommendation || false,
        is_locked: is_locked === true,
        recommendation_reason: recommendation_reason || null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)) as any;

    if (updateError) {
      errors.push(`更新項目 ${id} 失敗: ${updateError.message}`);
    } else {
      updatedCount++;
    }
  }

  // ==================
  // 8. 批量插入新項目
  // ==================
  if (itemsToInsert.length > 0) {
    const itemsForInsert = itemsToInsert.map((item: any) => ({
      routine_id,
      user_id: userId,
      product_name: item.product_name,
      product_category: item.product_category,
      day_of_week: item.day_of_week,
      time_of_day: item.time_of_day,
      sequence_order: item.sequence_order,
      ingredients: item.ingredients || [],
      is_recommendation: item.is_recommendation || false,
      is_locked: item.is_locked === true,
      recommendation_reason: item.recommendation_reason || null,
      notes: item.notes || null
    }));

    const { data: insertData, error: insertError } = (await (supabase as any)
      .from('routine_items')
      .insert(itemsForInsert)
      .select()) as any;

    if (insertError) {
      errors.push(`批量插入新項目失敗: ${insertError.message}`);
    } else if (insertData) {
      insertedCount = insertData.length;
    }
  }

  // ==================
  // 9. 批量刪除舊項目（前端沒有的項目）
  // ==================
  if (itemsToDelete.length > 0) {
    const idsToDelete = itemsToDelete.map((item: any) => item.id);

    const { error: deleteError } = (await (supabase as any)
      .from('routine_items')
      .delete()
      .in('id', idsToDelete)) as any;

    if (deleteError) {
      errors.push(`批量刪除項目失敗: ${deleteError.message}`);
    } else {
      deletedCount = itemsToDelete.length;
    }
  }

  // ==================
  // 10. 返回結果
  // ==================
  const allSuccess = errors.length === 0;

  return {
    success: allSuccess,
    data: {
      updated_count: updatedCount,
      inserted_count: insertedCount,
      deleted_count: deletedCount,
      failed_count: errors.length,
      errors: errors.length > 0 ? errors : undefined
    },
    message: allSuccess
      ? `成功同步：更新 ${updatedCount} 個、插入 ${insertedCount} 個、刪除 ${deletedCount} 個項目`
      : `部分操作失敗：更新 ${updatedCount}、插入 ${insertedCount}、刪除 ${deletedCount}、失敗 ${errors.length}`
  };
});
