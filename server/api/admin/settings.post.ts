import { serverSupabaseUser } from '#supabase/server';
import { createClient } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  const adminEmail = process.env.NUXT_ADMIN_EMAIL;

  if (!user || !adminEmail || user.email !== adminEmail) {
    throw createError({ statusCode: 403, statusMessage: '無權限' });
  }

  const body = await readBody(event);
  const { key, value } = body;

  if (!key || value === undefined) {
    throw createError({ statusCode: 400, statusMessage: '缺少 key 或 value' });
  }

  const config = useRuntimeConfig(event);
  const supabase = createClient(config.public.supabaseUrl, config.supabaseSecretKey);

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: '更新設定失敗: ' + error.message });
  }

  return { success: true };
});
