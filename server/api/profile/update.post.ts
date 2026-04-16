import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  // 1. 驗證使用者登入狀態
  const user = await serverSupabaseUser(event);
  
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: '請先登入才能更新個人資料' });
  }

  const userId = user.id || user.sub;
  
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
  }

  // 2. 取得請求 body
  const body = (await readBody(event)) || {};

  // 同時接受舊版 camelCase 與新版 snake_case 欄位
  const skinType = body.base_skin_type ?? body.skinType;
  const ageGroup = body.age_group ?? body.ageGroup;
  const gender = body.gender;
  const issues = body.issues;
  const birthYear = body.birth_year ?? body.birthYear;

  const hasAnyField = [skinType, ageGroup, gender, issues, birthYear].some(v => v !== undefined);
  if (!hasAnyField) {
    throw createError({ statusCode: 400, statusMessage: '至少需要提供一個欄位進行更新' });
  }

  // 3. 取得 Supabase 客戶端
  const supabase = await serverSupabaseClient(event);

  // 4. 檢查 profiles 表是否存在該用戶
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  // 5. 準備更新的資料，僅包含提供的欄位
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  };

  if (skinType !== undefined) {
    updateData.base_skin_type = skinType || null;
  }
  if (ageGroup !== undefined) {
    updateData.age_group = ageGroup || null;
  }
  if (gender !== undefined) {
    // 驗證 gender 值
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      throw createError({ statusCode: 400, statusMessage: '性別值無效' });
    }
    updateData.gender = gender || null;
  }
  if (birthYear !== undefined) {
    // 驗證 birth_year 值
    if (birthYear) {
      const currentYear = new Date().getFullYear();
      const year = Number(birthYear);
      if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
        throw createError({ statusCode: 400, statusMessage: '出生年份無效' });
      }
      updateData.birth_year = year;
    } else {
      updateData.birth_year = null;
    }
  }
  if (issues !== undefined) {
    updateData.issues = issues || null;
  }

  // 更新或插入用戶資料
  let result;
  
  if (existingProfile) {
    // 用戶已存在，執行更新
    const { data, error } = await (supabase as any)
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Profile Update Error]:', error);
      throw createError({ 
        statusCode: 500, 
        statusMessage: '更新個人資料失敗: ' + error.message 
      });
    }
    result = data;
  } else {
    // 用戶不存在，建立新記錄
    const insertData: Record<string, any> = {
      id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (skinType !== undefined) {
      insertData.base_skin_type = skinType || null;
    }
    if (ageGroup !== undefined) {
      insertData.age_group = ageGroup || null;
    }
    if (gender !== undefined) {
      insertData.gender = gender || null;
    }
    if (birthYear !== undefined) {
      insertData.birth_year = birthYear ? Number(birthYear) : null;
    }
    if (issues !== undefined) {
      insertData.issues = issues || null;
    }

    const { data, error } = await (supabase as any)
      .from('profiles')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Profile Create Error]:', error);
      throw createError({ 
        statusCode: 500, 
        statusMessage: '建立個人資料失敗: ' + error.message 
      });
    }
    result = data;
  }

  console.log('[Profile API] 用戶 ID:', userId, '更新成功，膚質:', skinType);

  return {
    success: true,
    data: result,
    message: '個人資料已更新'
  };
});
