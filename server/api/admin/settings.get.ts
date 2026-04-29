import { serverSupabaseUser } from '#supabase/server';
import { createClient } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  const adminEmail = process.env.NUXT_ADMIN_EMAIL;

  if (!user || !adminEmail || user.email !== adminEmail) {
    throw createError({ statusCode: 403, statusMessage: '無權限' });
  }

  const config = useRuntimeConfig(event);
  const supabase = createClient(config.public.supabaseUrl, config.supabaseSecretKey);

  const { data, error } = await supabase.from('app_settings').select('*');

  if (error) {
    throw createError({ statusCode: 500, statusMessage: '讀取設定失敗' });
  }

  return { success: true, data };
});
