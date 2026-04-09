export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],
  
  // 明確啟用頁面路由
  pages: true,
  
  // 啟用所有自動導入
  imports: {
    autoImport: true
  },
  
  // 路由配置
  router: {
    options: {
      hashMode: false
    }
  },
  
  supabase: {
    redirect: false,  // 禁用自動重導，由我們手動控制
  },
  
  runtimeConfig: {
    // 後端 API 用的 Service Key（私密）
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    
    public: {
      // 前端可以存取的公開設定
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    }
  }
})