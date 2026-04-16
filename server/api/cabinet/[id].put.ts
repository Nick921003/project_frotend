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
  const { product_name, product_category, raw_ingredients } = body;
  const normalizedCategory = normalizeProductCategory(product_category);

  if (!product_name || !product_category) {
    throw createError({ 
      statusCode: 400, 
      statusMessage: '產品名稱和分類不能為空' 
    });
  }

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
    .update({
      product_name,
      product_category: normalizedCategory,
      raw_ingredients: raw_ingredients || null
    })
    .eq('id', productId)
    .select();

  if (error) {
    console.error('[Cabinet Update Error]:', error);
    throw createError({ 
      statusCode: 500, 
      statusMessage: '更新產品失敗: ' + error.message 
    });
  }

  return {
    success: true,
    message: '產品已更新',
    data: data?.[0] || {}
  };
});
