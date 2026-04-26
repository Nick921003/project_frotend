<template>
  <div class="page-container">
    <h1 class="page-heading" style="text-align: center;">個人資料設定</h1>
    <p class="subtitle">完成您的個人資料，以便 AI 能夠提供更精準的保養建議</p>

    <div class="card">
      <div v-if="loading" class="status-box status-loading">⏳ 正在提交資料...</div>
      <div v-if="error" class="status-box status-error">❌ {{ error }}</div>
      <div v-if="saveSuccess" class="status-box status-success">✅ 個人資料已成功保存！</div>

      <form v-if="!loading" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label" for="skinType">膚質類型 *</label>
          <select id="skinType" v-model="formData.base_skin_type" class="form-input" required>
            <option value="">— 請選擇 —</option>
            <option value="dry">乾性</option>
            <option value="oily">油性</option>
            <option value="combination">混合性</option>
            <option value="sensitive">敏感性</option>
            <option value="normal">中性</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="gender">性別</label>
          <select id="gender" v-model="formData.gender" class="form-input">
            <option value="">— 未選擇 —</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="birthYear">出生年份</label>
          <input
            id="birthYear"
            v-model.number="formData.birth_year"
            type="number"
            class="form-input"
            placeholder="例如：1995"
            min="1900"
            :max="currentYear"
          />
          <p v-if="formData.birth_year && computedUserAge" class="hint-text">
            您目前的年齡：{{ computedUserAge }} 歲
          </p>
        </div>

        <div class="form-group">
          <label class="form-label" for="issues">肌膚問題或過敏成分</label>
          <div class="help-hint">
            請填入您想改善的肌膚問題（例如：痘痘、粉刺、敏感、暗沉）或已知過敏成分（例如：酒精、香料）。每項間用逗號分隔。
          </div>
          <textarea
            id="issues"
            v-model="formData.issues"
            class="form-input"
            style="height: 100px; resize: vertical;"
            placeholder="例如：痘痘, 油痘, 對酒精敏感, 需要抗衰老"
          ></textarea>
        </div>

        <div v-if="issuesPreview.length > 0" class="preview-block">
          <p class="preview-label">您指定的需求：</p>
          <div class="issues-chips">
            <span v-for="(issue, idx) in issuesPreview" :key="idx" class="badge badge-muted">
              {{ issue }}
            </span>
          </div>
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-lg submit-btn"
          :disabled="loading || !formData.base_skin_type"
        >
          {{ loading ? '提交中...' : '保存個人資料' }}
        </button>
      </form>
    </div>

    <div class="card info-card">
      <h2 class="section-title" style="font-size: 16px;">為什麼需要這些資訊？</h2>
      <ul class="info-list">
        <li><strong>膚質類型：</strong>幫助 AI 了解您的皮膚基礎需求（保濕、控油、舒緩等）</li>
        <li><strong>性別：</strong>考慮性別特定的肌膚變化（如激素影響）</li>
        <li><strong>年齡：</strong>針對不同年齡階段提供合適的抗衰老或預防建議</li>
        <li><strong>肌膚問題：</strong>幫助 AI 設計針對性的保養排程，推薦缺失的成分或產品</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserProfile } from '~/stores/useUserProfile'

const userProfileStore = useUserProfile()
const { profile, loading, error, saveSuccess, userAge: computedUserAge } = storeToRefs(userProfileStore)

const currentYear = new Date().getFullYear()

const formData = ref({
  base_skin_type: '',
  gender: '' as 'male' | 'female' | 'other' | '',
  birth_year: null as number | null,
  issues: ''
})

const issuesPreview = computed(() => {
  if (!formData.value.issues) return []
  return formData.value.issues
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)
})

const loadProfileData = () => {
  if (profile.value) {
    formData.value = {
      base_skin_type: profile.value.base_skin_type || '',
      gender: (profile.value.gender as any) || '',
      birth_year: profile.value.birth_year || null,
      issues: profile.value.issues || ''
    }
  }
}

const handleSubmit = async () => {
  if (!formData.value.base_skin_type) {
    error.value = '膚質類型為必填項'
    return
  }

  await userProfileStore.updateUserProfile({
    base_skin_type: formData.value.base_skin_type,
    gender: formData.value.gender || null,
    birth_year: formData.value.birth_year || null,
    issues: formData.value.issues || null
  })

  if (saveSuccess.value) {
    await userProfileStore.fetchUserProfile()
    loadProfileData()
  }
}

onMounted(async () => {
  if (!profile.value) {
    await userProfileStore.fetchUserProfile()
  }
  loadProfileData()
})
</script>

<style scoped>
.page-heading {
  font-size: 24px;
  margin-bottom: var(--space-2);
}

.subtitle {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;
  margin-bottom: var(--space-6);
}

.hint-text {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: var(--space-2);
  margin-bottom: 0;
}

.help-hint {
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-3);
  line-height: 1.6;
}

.preview-block {
  background: var(--color-accent-light);
  border: 1px solid #E8D0C8;
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-5);
}

.preview-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-accent);
  margin: 0 0 var(--space-3);
}

.issues-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.submit-btn {
  width: 100%;
  margin-top: var(--space-2);
}

.info-card {
  background: var(--color-surface-alt);
}

.info-list {
  margin: 0;
  padding-left: var(--space-5);
}

.info-list li {
  margin-bottom: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.info-list strong {
  color: var(--color-text-primary);
}
</style>
