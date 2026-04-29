import { createClient } from '@supabase/supabase-js';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const supabase = createClient(config.public.supabaseUrl, config.supabaseSecretKey);

  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'registration_enabled')
    .single();

  return { enabled: data?.value !== 'false' };
});
