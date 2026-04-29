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

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('guest_rate_limits')
    .select('ip, count')
    .eq('date', today)
    .order('count', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: '讀取統計失敗' });
  }

  const totalRequests = (data ?? []).reduce((sum: number, row: any) => sum + row.count, 0);

  return {
    success: true,
    date: today,
    totalRequests,
    byIp: data ?? []
  };
});
