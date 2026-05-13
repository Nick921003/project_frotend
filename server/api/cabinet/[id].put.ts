import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { normalizeProductCategory } from '~/utils/productCategories';

export default defineEventHandler(async (event) => {
  // 1. 驗證使用者登入狀態
  const user = await serverSupabaseUser(event);
  
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入' });
  }

  const userId = user.id || user.sub;
  
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  // 2. 取得產品 ID
  const productId = getRouterParam(event, 'id');
  
  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: '缺少產品 ID' });
  }

  // 3. 取得請求體
  const body = await readBody(event);
  const {
    product_name,
    product_category,
    opened_at,
    estimated_finish_days,
    purchase_purpose,
    user_notes
  } = body;

  // 至少需要一個欄位
  const hasBasicFields = product_name || product_category;
  const hasTrackingFields = opened_at !== undefined || estimated_finish_days !== undefined ||
    purchase_purpose !== undefined || user_notes !== undefined;

  if (!hasBasicFields && !hasTrackingFields) {
    throw createError({ statusCode: 400, statusMessage: '請提供至少一個要更新的欄位' });
  }

  // 組裝 update object（只包含有提供的欄位）
  const updateData: Record<string, any> = {};
  if (product_name) updateData.product_name = product_name;
  if (product_category) updateData.product_category = normalizeProductCategory(product_category);
  if (opened_at !== undefined) updateData.opened_at = opened_at;
  if (estimated_finish_days !== undefined) updateData.estimated_finish_days = estimated_finish_days;
  if (purchase_purpose !== undefined) updateData.purchase_purpose = purchase_purpose;
  if (user_notes !== undefined) updateData.user_notes = user_notes;

  // 4. 取得 Supabase 客戶端
  const supabase = await serverSupabaseClient(event);

  // 5. 驗證產品是否存在且屬於該使用者
  const { data: existingProduct, error: fetchError } = await supabase
    .from('user_cabinet')
    .select('id, user_id')
    .eq('id', productId)
    .single();

  if (fetchError || !existingProduct) {
    throw createError({ statusCode: 404, statusMessage: '找不到該產品' });
  }

  if (existingProduct.user_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: '無權編輯此產品' });
  }

  // 6. 更新產品
  const { data, error } = await supabase
    .from('user_cabinet')
    .update(updateData)
    .eq('id', productId)
    .select();

  if (error) {
    console.error('[Cabinet Update Error]:', error);
    throw createError({
      statusCode: 500,
      statusMessage: '更新產品失敗: ' + error.message
    });
  }

  // 同步所有排程中此產品的名稱
  const { error: syncError } = await (supabase as any)
    .from('routine_items')
    .update({ product_name })
    .eq('product_id', productId);

  if (syncError) {
    // 不中斷主流程，僅記 warning
    console.warn('[Cabinet PUT] routine_items 改名同步失敗:', syncError.message);
  }

  return {
    success: true,
    message: '產品已更新',
    data: data?.[0] || {}
  };
});
