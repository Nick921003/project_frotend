import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  // 1. 驗證使用者登入狀態
  const user = await serverSupabaseUser(event);
  
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入才能刪除產品' });
  }

  // 取得用戶 ID
  const userId = user.id || user.sub;
  
  if (!userId) {
    console.error('[Cabinet Delete API] 無法取得用戶 ID，user 物件:', user);
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  // 2. 取得要刪除的產品 ID
  const productId = event.context.params.id;
  
  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: '缺少產品 ID' });
  }

  console.log('[Cabinet Delete API] 用戶 ID:', userId, '| 刪除產品 ID:', productId);

  // 3. 取得有權限的 Supabase 客戶端
  const supabase = await serverSupabaseClient(event);

  // 4. 先驗證該產品是否屬於該使用者
  const { data: product, error: fetchError } = await supabase
    .from('user_cabinet')
    .select('id, user_id')
    .eq('id', productId)
    .single();

  if (fetchError || !product) {
    console.error('[Cabinet Delete Error] 產品查詢失敗:', fetchError);
    throw createError({ statusCode: 404, statusMessage: '產品不存在' });
  }

  // 5. 確保產品屬於當前登入的使用者
  if (product.user_id !== userId) {
    console.warn('[Cabinet Delete] 未授權刪除: 用戶', userId, '嘗試刪除不屬於他的產品', productId);
    throw createError({ statusCode: 403, statusMessage: '無權限刪除此產品' });
  }

  // 6. 執行刪除操作
  const { error: deleteError } = await supabase
    .from('user_cabinet')
    .delete()
    .eq('id', productId)
    .eq('user_id', userId);

  if (deleteError) {
    console.error('[Cabinet Delete Error]:', deleteError);
    throw createError({ 
      statusCode: 500, 
      statusMessage: '刪除產品失敗: ' + deleteError.message 
    });
  }

  console.log('[Cabinet Delete] 成功刪除產品 ID:', productId);

  return {
    success: true,
    message: '產品已刪除'
  };
});
