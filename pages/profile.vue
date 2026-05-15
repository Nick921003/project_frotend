<template>
  <div class="page-container">
    <h1 class="page-heading">個人資料中心</h1>

    <!-- 基本資料卡片 -->
    <div class="card mb-4">
      <h2 class="section-title" style="font-size: 16px; margin-bottom: var(--space-5);">基本資料</h2>

      <form @submit.prevent="handleSubmit">
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
          <label class="form-label">進階使用者模式</label>
          <p class="hint-text">開啟後，分析頁的「膚質地雷」提示將隱藏。法規禁用成分警告不受影響。</p>
          <label class="toggle-switch">
            <input type="checkbox" v-model="formData.suppressSafetyWarnings" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-label">
              {{ formData.suppressSafetyWarnings ? '已開啟（隱藏膚質提示）' : '關閉（顯示所有警告）' }}
            </span>
          </label>
        </div>

        <div class="form-footer">
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? '儲存中...' : '儲存修改' }}
          </button>
          <span v-if="successMessage" class="feedback feedback--success">✅ {{ successMessage }}</span>
          <span v-if="errorMessage"   class="feedback feedback--error">❌ {{ errorMessage }}</span>
        </div>
      </form>
    </div>

    <!-- 膚況摘要卡片 -->
    <div class="card mb-4">
      <div class="skin-summary-header">
        <h2 class="section-title" style="font-size: 16px; margin: 0;">膚況設定</h2>
        <button class="btn btn-sm btn-ghost" @click="navigateTo('/profile-setup?from=profile')">重新設定</button>
      </div>

      <!-- 膚質 -->
      <div class="summary-row">
        <span class="summary-label">基礎膚質</span>
        <span v-if="profile?.base_skin_type" class="skin-type-badge">
          {{ SKIN_TYPE_LABEL[profile.base_skin_type] ?? profile.base_skin_type }}
        </span>
        <span v-else class="text-text-secondary text-sm">尚未設定</span>
      </div>

      <!-- 肌膚困擾 -->
      <div class="summary-row">
        <span class="summary-label">肌膚困擾</span>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="c in skinConcernsArray" :key="c" class="concern-tag">
            {{ CONCERN_LABEL[c] ?? c }}
          </span>
          <span v-for="c in customSkinConcernsArray" :key="'custom-' + c" class="concern-tag concern-tag--custom">
            {{ c }}
          </span>
          <span v-if="skinConcernsArray.length === 0 && customSkinConcernsArray.length === 0" class="text-text-secondary text-sm">尚未設定</span>
        </div>
      </div>

      <!-- 日常習慣 -->
      <div class="summary-row" style="border-bottom: none;">
        <span class="summary-label">日常習慣</span>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="h in dailyHabitsArray" :key="h" class="habit-tag">
            {{ HABIT_LABEL[h] ?? h }}
          </span>
          <span v-for="h in customDailyHabitsArray" :key="'custom-' + h" class="habit-tag habit-tag--custom">
            {{ h }}
          </span>
          <span v-if="dailyHabitsArray.length === 0 && customDailyHabitsArray.length === 0" class="text-text-secondary text-sm">尚未設定</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserProfile, SKIN_CONCERNS_OPTIONS, DAILY_HABITS_OPTIONS } from '~/stores/useUserProfile'

type Gender = 'male' | 'female' | 'other' | '';

const userProfileStore = useUserProfile()
const { profile, skinConcernsArray, customSkinConcernsArray, dailyHabitsArray, customDailyHabitsArray } = storeToRefs(userProfileStore)

// 顯示用 label map
const SKIN_TYPE_LABEL: Record<string, string> = {
  oily:             '油性肌',
  dry:              '乾性肌',
  combination_oily: '混合偏油',
  combination_dry:  '混合偏乾',
  sensitive:        '敏感肌',
  combination:      '混合性肌膚',
  normal:           '中性肌膚',
}

const CONCERN_LABEL = Object.fromEntries(SKIN_CONCERNS_OPTIONS.map(o => [o.value, o.label]))
const HABIT_LABEL   = Object.fromEntries(DAILY_HABITS_OPTIONS.map(o => [o.value, o.label]))

const formData = ref({
  ageGroup:               '',
  gender:                 '' as Gender,
  suppressSafetyWarnings: false,
})

const saving         = ref(false)
const successMessage = ref('')
const errorMessage   = ref('')

const fillFormFromStore = () => {
  const p = profile.value
  if (!p) return
  formData.value = {
    ageGroup:               p.age_group || '',
    gender:                 (p.gender || '') as Gender,
    suppressSafetyWarnings: p.suppress_safety_warnings ?? false,
  }
}

const handleSubmit = async () => {
  saving.value       = true
  errorMessage.value = ''
  try {
    await userProfileStore.updateUserProfile({
      age_group:                formData.value.ageGroup  || null,
      gender:                   (formData.value.gender   || null) as 'male' | 'female' | 'other' | null,
      suppress_safety_warnings: formData.value.suppressSafetyWarnings,
    })

    if (userProfileStore.error) throw new Error(userProfileStore.error)

    await userProfileStore.fetchUserProfile()
    fillFormFromStore()
    successMessage.value = '資料已成功保存！'
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (error: any) {
    errorMessage.value = error.data?.statusMessage || error.message || '保存失敗，請重試'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!profile.value) await userProfileStore.fetchUserProfile()
  fillFormFromStore()
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
.feedback--error   { color: var(--color-red);  }

.toggle-switch { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; }
.toggle-switch input { display: none; }
.toggle-track {
  width: 40px; height: 22px;
  background: var(--color-border);
  border-radius: 11px;
  position: relative;
  transition: background 0.2s;
}
.toggle-switch input:checked ~ .toggle-track { background: var(--color-sage); }
.toggle-thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 16px; height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: left 0.2s;
}
.toggle-switch input:checked ~ .toggle-track .toggle-thumb { left: 21px; }
.toggle-label { font-size: 13px; color: var(--color-text-secondary); }

/* ── Skin summary ── */
.skin-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.summary-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.summary-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
  min-width: 72px;
  padding-top: 2px;
  flex-shrink: 0;
}

.skin-type-badge {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-accent);
}

.concern-tag,
.habit-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
}

.concern-tag {
  background: var(--color-accent-light);
  color: var(--color-accent);
  border: 1px solid var(--color-warm-dark);
}

.habit-tag {
  background: var(--color-surface-alt);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-light);
}

.concern-tag--custom {
  background: var(--color-surface-alt);
  color: var(--color-accent);
  border: 1px dashed var(--color-accent);
}

.habit-tag--custom {
  background: var(--color-surface-alt);
  color: var(--color-text-secondary);
  border: 1px dashed var(--color-border);
}
</style>
