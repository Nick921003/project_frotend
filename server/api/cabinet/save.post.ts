import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { normalizeProductCategory } from '~/utils/productCategories';

export default defineEventHandler(async (event) => {
  // 1. 驗證使用者登入狀態 (防堵未登入的 API 呼叫)
  const user = await serverSupabaseUser(event);
  
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入才能儲存產品' });
  }

  // 取得用戶 ID（JWT token 中通常是 sub，也可能是 id）
  const userId = user.id || user.sub;
  
  if (!userId) {
    console.error('[Cabinet API] 無法取得用戶 ID，user 物件:', user);
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  console.log('[Cabinet API] 用戶 ID:', userId, '| Email:', user.email);

  const body = await readBody(event);
  const { productName, productCategory, rawIngredients, analysisResult, overallSummary } = body;

  if (!productName || !rawIngredients) {
    throw createError({ statusCode: 400, statusMessage: '缺少產品名稱或成分分析資料' });
  }

  // 2. 取得有權限的 Supabase 客戶端
  const supabase = await serverSupabaseClient(event);
  const normalizedCategory = normalizeProductCategory(productCategory);

  // 3. 寫入資料庫
  const { data, error } = await supabase
    .from('user_cabinet')
    .insert({
      user_id: userId,
      product_name: productName,
      product_category: normalizedCategory,
      raw_ingredients: rawIngredients,
      analysis_result: analysisResult,
      overview: overallSummary || null
    } as any)
    .select()
    .single();

  if (error) {
    console.error('[Cabinet Save Error]:', error);
    // 詳細錯誤訊息幫助診斷問題
    const errorMessage = error.message || '未知錯誤';
    const errorDetails = error.details || '';
    throw createError({ 
      statusCode: 500, 
      statusMessage: `儲存至保養庫失敗: ${errorMessage}${errorDetails ? ' (' + errorDetails + ')' : ''}` 
    });
  }

  return {
    status: 'success',
    message: '已成功儲存至你的保養品櫃',
    data
  };
});