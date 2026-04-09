import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  // 1. 驗證使用者登入狀態 (防堵未登入的 API 呼叫)
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入才能儲存產品' });
  }

  const body = await readBody(event);
  const { productName, productCategory, rawIngredients, analysisResult } = body;

  if (!productName || !rawIngredients) {
    throw createError({ statusCode: 400, statusMessage: '缺少產品名稱或成分分析資料' });
  }

  // 2. 取得有權限的 Supabase 客戶端
  const supabase = await serverSupabaseClient(event);

  // 3. 寫入資料庫
  const { data, error } = await supabase
    .from('user_cabinet')
    .insert({
      user_id: user.id,
      product_name: productName,
      product_category: productCategory || '未分類',
      raw_ingredients: rawIngredients,
      analysis_result: analysisResult
    } as any)
    .select()
    .single();

  if (error) {
    console.error('[Cabinet Save Error]:', error);
    throw createError({ statusCode: 500, statusMessage: '儲存至保養庫失敗' });
  }

  return {
    status: 'success',
    message: '已成功儲存至你的保養品櫃',
    data
  };
});