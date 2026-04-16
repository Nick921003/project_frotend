/**
 * 診斷端點 - 檢查 Gemini API 配置
 * 僅限開發環境使用
 */
export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV !== 'development') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found'
    });
  }

  const config = useRuntimeConfig(event);

  const geminiApiKey = config.geminiApiKey;
  const supabaseUrl = config.public.supabaseUrl;
  const supabaseAnonKey = config.public.supabaseAnonKey;
  const supabaseSecretKey = config.supabaseSecretKey;

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    config: {
      gemini: {
        hasKey: !!geminiApiKey
      },
      supabase: {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        hasServiceKey: !!supabaseSecretKey
      }
    }
  };
});
