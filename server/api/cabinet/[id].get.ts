import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入' });
  }

  const userId = user.id || user.sub;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  const productId = getRouterParam(event, 'id');

  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: '缺少產品 ID' });
  }

  const supabase = await serverSupabaseClient(event);

  const { data: product, error } = await supabase
    .from('user_cabinet')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !product) {
    throw createError({ statusCode: 404, statusMessage: '找不到該產品' });
  }

  if (product.user_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: '無權查看此產品' });
  }

  return {
    success: true,
    data: product
  };
});