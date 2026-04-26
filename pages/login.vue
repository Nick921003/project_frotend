<template>
  <div class="login-wrap">
    <div class="login-card card">
      <h2 class="login-title">{{ isLoginMode ? '會員登入' : '註冊專屬保養帳號' }}</h2>

      <div class="form-group">
        <label class="form-label" for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="form-input"
          placeholder="your@email.com"
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="password">密碼</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="form-input"
          placeholder="請輸入密碼"
        />
      </div>

      <div v-if="!isLoginMode" class="form-group">
        <label class="form-label" for="skinType">基礎膚質</label>
        <select id="skinType" v-model="baseSkinType" class="form-input">
          <option value="oily">油性肌膚</option>
          <option value="dry">乾性肌膚</option>
          <option value="combination">混合性肌膚</option>
          <option value="sensitive">敏感性肌膚</option>
          <option value="normal">中性肌膚</option>
        </select>
      </div>

      <button
        class="btn btn-primary btn-lg login-btn"
        :disabled="isLoading"
        @click="handleAuth"
      >
        {{ isLoading ? '處理中...' : (isLoginMode ? '登入' : '註冊') }}
      </button>

      <p v-if="errorMsg" class="login-error">{{ errorMsg }}</p>

      <p class="login-toggle" @click="isLoginMode = !isLoginMode">
        {{ isLoginMode ? '沒有帳號？點此註冊' : '已有帳號？點此登入' }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const supabase = useSupabaseClient()

const isLoginMode = ref(true)
const isLoading = ref(false)
const errorMsg = ref('')

const email = ref('')
const password = ref('')
const baseSkinType = ref('oily')

const handleAuth = async () => {
  if (!email.value || !password.value) {
    errorMsg.value = '請填寫完整資訊'
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    if (isLoginMode.value) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      })
      if (error) throw error

      alert('登入成功！')
      await navigateTo('/')
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          data: { base_skin_type: baseSkinType.value }
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

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.login-title {
  font-size: 22px;
  margin-bottom: var(--space-6);
  text-align: center;
}

.login-btn {
  width: 100%;
  margin-top: var(--space-2);
}

.login-error {
  margin-top: var(--space-3);
  font-size: 14px;
  color: var(--color-red);
  text-align: center;
}

.login-toggle {
  margin-top: var(--space-4);
  text-align: center;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  margin-bottom: 0;
}

.login-toggle:hover {
  color: var(--color-accent);
}
</style>
