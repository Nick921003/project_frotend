<template>
  <div style="max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <h2>{{ isLoginMode ? '會員登入' : '註冊專屬保養帳號' }}</h2>
    
    <div style="margin-bottom: 15px;">
      <label>Email：</label>
      <input v-model="email" type="email" style="width: 100%; padding: 8px; margin-top: 5px;" />
    </div>

    <div style="margin-bottom: 15px;">
      <label>密碼：</label>
      <input v-model="password" type="password" style="width: 100%; padding: 8px; margin-top: 5px;" />
    </div>

    <!-- 只有註冊時才需要選基本膚質 -->
    <div v-if="!isLoginMode" style="margin-bottom: 20px;">
      <label>你的基礎膚質：</label>
      <select v-model="baseSkinType" style="width: 100%; padding: 8px; margin-top: 5px;">
        <option value="oily">油性肌膚 (Oily)</option>
        <option value="dry">乾性肌膚 (Dry)</option>
        <option value="combination">混合性肌膚 (Combination)</option>
        <option value="sensitive">敏感性肌膚 (Sensitive)</option>
        <option value="normal">中性肌膚 (Normal)</option>
      </select>
    </div>

    <button 
      @click="handleAuth" 
      :disabled="isLoading"
      style="width: 100%; padding: 10px; background: #000; color: #fff; cursor: pointer; border: none; border-radius: 4px;"
    >
      {{ isLoading ? '處理中...' : (isLoginMode ? '登入' : '註冊') }}
    </button>

    <p style="text-align: center; margin-top: 15px; cursor: pointer; color: #666;" @click="isLoginMode = !isLoginMode">
      {{ isLoginMode ? '沒有帳號？點此註冊' : '已有帳號？點此登入' }}
    </p>

    <p v-if="errorMsg" style="color: red; margin-top: 10px;">{{ errorMsg }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 使用 Nuxt Supabase 提供的 Composable
const supabase = useSupabaseClient()

const isLoginMode = ref(true)
const isLoading = ref(false)
const errorMsg = ref('')

const email = ref('')
const password = ref('')
const baseSkinType = ref('oily') // 註冊預設值

const handleAuth = async () => {
  if (!email.value || !password.value) {
    errorMsg.value = '請填寫完整資訊'
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    if (isLoginMode.value) {
      // 執行登入
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      })
      if (error) throw error
      
      alert('登入成功！')
      await navigateTo('/')

    } else {
      // 執行註冊 (將膚質資料藏在 metadata 裡一併送出)
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          data: {
            base_skin_type: baseSkinType.value // 讓後端 Trigger 抓取這筆資料
          }
        }
      })
      
      if (error) throw error

      alert('註冊成功！資料庫已自動為您建立專屬膚質檔案。')
    }
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    isLoading.value = false
  }
}
</script>