export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase', '@pinia/nuxt', '@nuxtjs/tailwindcss'],

  css: ['~/assets/css/main.css'],
  
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


  vite: {
    optimizeDeps: {
      include: ['cookie'],
    },
  },
  
  runtimeConfig: {
    // 後端 API 用的 Secret Key（私密）
    // 優先使用 NUXT_SUPABASE_SECRET_KEY，若被錯置為 publish key 則自動 fallback 至專案預設服務金鑰
    supabaseSecretKey: (process.env.NUXT_SUPABASE_SECRET_KEY && !process.env.NUXT_SUPABASE_SECRET_KEY.startsWith('sb_publish'))
      ? process.env.NUXT_SUPABASE_SECRET_KEY
      : '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    
    public: {
      // 前端可以存取的公開設定
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      googleApiKey: process.env.GOOGLE_API_KEY || '',
    }
  }
})