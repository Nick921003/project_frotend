import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  // 1. 驗證使用者登入狀態
  const user = await serverSupabaseUser(event);
  
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入才能查看產品列表' });
  }

  // 取得用戶 ID
  const userId = user.id || user.sub;
  
  if (!userId) {
    console.error('[Cabinet List API] 無法取得用戶 ID，user 物件:', user);
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  console.log('[Cabinet List API] 查詢用戶 ID:', userId);

  // 2. 取得有權限的 Supabase 客戶端
  const supabase = await serverSupabaseClient(event);

  const query = getQuery(event);
  const search = String(query.search || '').trim();
  const category = String(query.category || '').trim();

  const parsedLimit = Number.parseInt(String(query.limit ?? '10'), 10);
  const parsedOffset = Number.parseInt(String(query.offset ?? '0'), 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 10;
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  // 3. 從資料庫查詢該用戶產品，支援搜尋與分頁
  let queryBuilder = supabase
    .from('user_cabinet')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (search) {
    queryBuilder = queryBuilder.or(`product_name.ilike.%${search}%,product_category.ilike.%${search}%`);
  }

  if (category) {
    queryBuilder = queryBuilder.eq('product_category', category);
  }

  const { data, error, count } = await queryBuilder
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Cabinet List Error]:', error);
    throw createError({ 
      statusCode: 500, 
      statusMessage: '查詢產品列表失敗: ' + error.message 
    });
  }

  return {
    success: true,
    data: data || [],
    meta: {
      total: count ?? 0,
      limit,
      offset,
      hasMore: offset + (data?.length || 0) < (count ?? 0)
    }
  };
});
