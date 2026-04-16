import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

/**
 * GET /api/profile/get
 * 取得當前使用者的 profile 資料
 */
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

  // 2. 取得 Supabase 客戶端
  const supabase = await serverSupabaseClient(event);

  // 3. 查詢使用者 profile
  const { data, error } = await supabase
    .from('profiles')
    .select('id, base_skin_type, age_group, gender, birth_year, issues, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 是 "no rows" 錯誤，表示用戶不存在
    console.error('[Profile Get Error]:', error);
    throw createError({
      statusCode: 500,
      statusMessage: '查詢個人資料失敗: ' + error.message
    });
  }

  // 如果用戶不存在，返回 null 或空物件
  if (!data) {
    return {
      success: true,
      data: null
    };
  }

  return {
    success: true,
    data: {
      id: data.id,
      base_skin_type: data.base_skin_type || null,
      age_group: data.age_group || null,
      gender: data.gender || null,
      birth_year: data.birth_year || null,
      issues: data.issues || null,
      created_at: data.created_at,
      updated_at: data.updated_at
    }
  };
});
