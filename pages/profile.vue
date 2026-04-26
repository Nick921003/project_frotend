<template>
  <div class="page-container">
    <h1 class="page-heading">個人資料中心</h1>

    <div class="card">
      <h2 class="section-title" style="font-size: 16px; margin-bottom: var(--space-5);">基本資料設定</h2>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label" for="skinType">膚質類型</label>
          <select id="skinType" v-model="formData.skinType" class="form-input">
            <option value="">未選擇</option>
            <option value="dry">乾性</option>
            <option value="oily">油性</option>
            <option value="combination">混合性</option>
            <option value="sensitive">敏感性</option>
            <option value="normal">中性</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="ageGroup">年齡群組</label>
          <select id="ageGroup" v-model="formData.ageGroup" class="form-input">
            <option value="">未選擇</option>
            <option value="teens">10–19 歲</option>
            <option value="20s">20–29 歲</option>
            <option value="30s">30–39 歲</option>
            <option value="40s">40–49 歲</option>
            <option value="50plus">50+ 歲</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="gender">性別</label>
          <select id="gender" v-model="formData.gender" class="form-input">
            <option value="">未選擇</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="issues">肌膚問題或過敏成分</label>
          <p class="hint-text">可填入肌膚問題（如：痘痘、粉刺、敏感）或對哪些成分過敏（如：酒精、香料）</p>
          <textarea
            id="issues"
            v-model="formData.issues"
            class="form-input"
            style="height: 100px; resize: vertical;"
            placeholder="例如：容易長痘、對酒精敏感、害怕重金屬..."
          ></textarea>
        </div>

        <div class="form-footer">
          <button type="submit" class="btn btn-primary">儲存修改</button>
          <span v-if="successMessage" class="feedback feedback--success">✅ {{ successMessage }}</span>
          <span v-if="errorMessage" class="feedback feedback--error">❌ {{ errorMessage }}</span>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserProfile } from '~/stores/useUserProfile'

type Gender = 'male' | 'female' | 'other' | '';

const userProfileStore = useUserProfile()

const formData = ref({
  skinType: '',
  ageGroup: '',
  gender: '' as Gender,
  issues: ''
})

const successMessage = ref('')
const errorMessage = ref('')

const fillFormFromStore = () => {
  const profile = userProfileStore.profile
  if (!profile) return
  formData.value = {
    skinType: profile.base_skin_type || '',
    ageGroup: profile.age_group || '',
    gender: (profile.gender || '') as Gender,
    issues: profile.issues || ''
  }
}

const handleSubmit = async () => {
  if (!formData.value.skinType) {
    errorMessage.value = '請選擇膚質類型'
    return
  }

  try {
    await userProfileStore.updateUserProfile({
      base_skin_type: formData.value.skinType,
      age_group: formData.value.ageGroup || null,
      gender: (formData.value.gender || null) as 'male' | 'female' | 'other' | null,
      issues: formData.value.issues || null
    })

    if (userProfileStore.error) throw new Error(userProfileStore.error)

    await userProfileStore.fetchUserProfile()
    fillFormFromStore()

    successMessage.value = '資料已成功保存！'
    errorMessage.value = ''
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (error: any) {
    errorMessage.value = error.data?.statusMessage || error.message || '保存失敗，請重試'
  }
}

onMounted(async () => {
  try {
    await userProfileStore.fetchUserProfile()
    fillFormFromStore()
  } catch (err) {
    console.error('載入個人資料失敗:', err)
  }
})
</script>

<style scoped>
.page-heading {
  font-size: 24px;
  margin-bottom: var(--space-6);
}

.hint-text {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.form-footer {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding-top: var(--space-2);
}

.feedback {
  font-size: 14px;
  font-weight: 500;
}

.feedback--success { color: var(--color-sage); }
.feedback--error   { color: var(--color-red); }
</style>
