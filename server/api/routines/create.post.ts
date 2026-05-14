import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import type { UserProfileData, CabinetProduct, WeeklyRoutine } from '~/types/routine';

/**
 * POST /api/routines/create
 * 
 * 使用 Gemini AI 根據使用者資料與現有產品生成每週保養規劃
 * 
 * Request body:
 * {
 *   useAI: boolean (optional, default: true)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     routine_id?: string,
 *     name: string,
 *     description: string,
 *     items: RoutineItem[],
 *     is_active: boolean,
 *     created_by_ai: boolean,
 *     gemini_prompt_used?: string
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
  // ==================
  // 3. 初始化 Supabase 客戶端
  // ==================
  const supabase = await serverSupabaseClient(event);

  // ==================
  // 3.5 限制每位使用者最多 3 份排程
  // ==================
  const { count: routineCount, error: countError } = await (supabase as any)
    .from('routines')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    throw createError({
      statusCode: 500,
      statusMessage: '檢查排程數量失敗: ' + countError.message
    });
  }

  if ((routineCount || 0) >= 3) {
    throw createError({
      statusCode: 409,
      statusMessage: '目前已有 3 個保養規劃，已達上限'
    });
  }

  // ==================
  // 4. 取得使用者 profile 資料
  // ==================
  const { data: profileData, error: profileError } = (await (supabase as any)
    .from('profiles')
    .select('id, base_skin_type, gender, birth_year, issues')
    .eq('id', userId)
    .single()) as any;

  if (profileError && profileError.code !== 'PGRST116') {
    throw createError({
      statusCode: 500,
      statusMessage: '取得個人資料失敗: ' + profileError.message
    });
  }

  if (!profileData) {
    throw createError({
      statusCode: 400,
      statusMessage: '尚未建立個人資料，請先完成第一步設定'
    });
  }

  const userProfile: UserProfileData = {
    id: profileData.id,
    base_skin_type: profileData.base_skin_type || 'normal',
    gender: profileData.gender || null,
    birth_year: profileData.birth_year || null,
    issues: profileData.issues || null
  };

  // ==================
  // 5. 取得使用者的現有產品列表
  // ==================
  const { data: cabinetData, error: cabinetError } = (await (supabase as any)
    .from('user_cabinet')
    .select('id, user_id, product_name, product_category, raw_ingredients, analysis_result, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })) as any;

  if (cabinetError) {
    throw createError({
      statusCode: 500,
      statusMessage: '取得產品列表失敗: ' + cabinetError.message
    });
  }

  const products: CabinetProduct[] = cabinetData || [];

  console.log(`[Routines Create] 用戶 ${userId}，產品數=${products.length}`);


  // ==================
  // 6. 建立空排程（由使用者自行拖拽填入產品）
  // ==================
  const weeklyRoutine: WeeklyRoutine = {
    name: '我的保養規劃',
    description: '',
    items: [],
    recommendations: [],
    is_active: true,
    created_by_ai: false,
    _empty_reason: products.length === 0 ? 'no_products' : 'no_items',
  };

  console.log(`[Routines Create] 建立空排程完成`);

  // ==================
  // 8.5 檢查並禁用現有的 active routine
  // ==================
  try {
    // 查詢該用戶是否已有 active routine
    const { data: existingActive, error: checkError } = (await (supabase as any)
      .from('routines')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()) as any;

    // 如果有現有的 active routine（不是因為沒找到的錯誤），則將其設為非活躍
    if (existingActive && existingActive.id) {
      const { error: updateError } = (await (supabase as any)
        .from('routines')
        .update({ is_active: false })
        .eq('id', existingActive.id)) as any;

      if (updateError) {
        console.warn('[Routines Create] 禁用舊 routine 時出現警告:', updateError.message);
        // 不中斷流程
      } else {
        console.log(`[Routines Create] 已禁用舊 routine: ${existingActive.id}`);
      }
    }
  } catch (checkErr: any) {
    console.warn('[Routines Create] 檢查現有 routine 時出現錯誤:', checkErr);
    // 不中斷流程
  }

  // ==================
  // 9. 將排程保存到資料庫
  // ==================
  try {
    // 9.1 插入 routines 表記錄
    const { data: routineInsert, error: routineInsertError } = (await (supabase as any)
      .from('routines')
      .insert({
        user_id: userId,
        name: weeklyRoutine.name,
        description: weeklyRoutine.description,
        is_active: weeklyRoutine.is_active,
        created_by_ai: weeklyRoutine.created_by_ai,
        gemini_prompt_used: weeklyRoutine.gemini_prompt_used ? weeklyRoutine.gemini_prompt_used.slice(0, 5000) : null // 限制長度
      })
      .select('id')) as any;

    if (routineInsertError || !routineInsert || !routineInsert[0]) {
      throw new Error('無法保存排程: ' + (routineInsertError?.message || '未知錯誤'));
    }

    const routineId = routineInsert[0].id;
    console.log(`[Routines Create] 排程已保存，ID: ${routineId}`);

    // 9.2 批量插入 routine_items 記錄
    const itemsToInsert = weeklyRoutine.items.map(item => ({
      routine_id: routineId,
      user_id: userId,
      day_of_week: item.day_of_week,
      time_of_day: item.time_of_day,
      sequence_order: item.sequence_order,
      product_name: item.product_name,
      product_category: item.product_category,
      ingredients: item.ingredients || [],
      is_recommendation: item.is_recommendation,
      recommendation_reason: item.recommendation_reason || null,
      notes: item.notes || null,
      product_id: item.is_recommendation ? null : (nameToId.get(normalizeName(item.product_name)) ?? null)
    }));

    if (itemsToInsert.length > 0) {
      const { data: itemsInsert, error: itemsInsertError } = (await (supabase as any)
        .from('routine_items')
        .insert(itemsToInsert)
        .select('id')) as any;

      if (itemsInsertError) {
        console.warn('[Routines Create] 批量插入項目時出現警告:', itemsInsertError.message);
        // 不中斷流程，繼續返回
      } else {
        console.log(`[Routines Create] 插入 ${itemsInsert?.length || 0} 個排程項目`);
      }
    }

    // 9.3 返回結果，包含 routine_id
    return {
      success: true,
      data: {
        routine_id: routineId,
        name: weeklyRoutine.name,
        description: weeklyRoutine.description,
        items: weeklyRoutine.items,
        recommendations: weeklyRoutine.recommendations || [],
        is_active: weeklyRoutine.is_active,
        created_by_ai: weeklyRoutine.created_by_ai,
        gemini_prompt_used: weeklyRoutine.gemini_prompt_used,
        _empty_reason: weeklyRoutine._empty_reason, // 傳遞空排程原因給前端
        all_products: products.map(p => ({
          id: p.id,
          product_name: p.product_name,
          product_category: p.product_category,
          raw_ingredients: p.raw_ingredients,
          is_recommendation: false
        }))
      },
      message: '保養規劃已生成並保存'
    };
  } catch (saveError: any) {
    console.error('[Routines Create - Save Error]:', saveError);
    throw createError({
      statusCode: 500,
      statusMessage: '保存排程失敗: ' + (saveError.message || '未知錯誤')
    });
  }
});
