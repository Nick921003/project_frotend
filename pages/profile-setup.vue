<template>
  <div class="profile-setup-container">
    <h1>⚙️ 個人資料設定</h1>
    <p class="subtitle">完成您的個人資料，以便 AI 能夠提供更精準的保養建議</p>

    <!-- 主表單區塊 -->
    <div class="form-card">
      <!-- 載入狀態 -->
      <div v-if="loading" class="loading-message">
        ⏳ 正在提交資料...
      </div>

      <!-- 錯誤提示 -->
      <div v-if="error" class="error-message">
        ❌ {{ error }}
      </div>

      <!-- 成功提示 -->
      <div v-if="saveSuccess" class="success-message">
        ✅ 個人資料已成功保存！
      </div>

      <!-- 表單內容 -->
      <form @submit.prevent="handleSubmit" v-if="!loading">
        <div class="form-group">
          <label for="skinType">膚質類型：*</label>
          <select
            id="skinType"
            v-model="formData.base_skin_type"
            class="form-input"
            required
          >
            <option value="">— 請選擇 —</option>
            <option value="dry">乾性</option>
            <option value="oily">油性</option>
            <option value="combination">混合性</option>
            <option value="sensitive">敏感性</option>
            <option value="normal">中性</option>
          </select>
        </div>

        <div class="form-group">
          <label for="gender">性別：</label>
          <select id="gender" v-model="formData.gender" class="form-input">
            <option value="">— 未選擇 —</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div class="form-group">
          <label for="birthYear">出生年份：</label>
          <input
            id="birthYear"
            v-model.number="formData.birth_year"
            type="number"
            class="form-input"
            placeholder="例如: 1995"
            min="1900"
            :max="currentYear"
          />
          <small v-if="formData.birth_year && computedUserAge" class="help-text">
            📊 您目前的年齡：{{ computedUserAge }} 歲
          </small>
        </div>

        <div class="form-group">
          <label for="issues">肌膚問題或過敏成分：</label>
          <div class="help-text-block">
            <p>
              請填入您想改善的肌膚問題（例如：痘痘、粉刺、敏感、暗沉）或已知會過敏的成分（例如：酒精、香料、防腐劑）。每項間用逗號分隔。
            </p>
          </div>
          <textarea
            id="issues"
            v-model="formData.issues"
            class="form-textarea"
            placeholder="例如: 痘痘, 油痘, 對酒精敏感, 需要抗衰老"
            rows="4"
          ></textarea>
        </div>

        <!-- 已解析的 issues 預覽 -->
        <div v-if="issuesPreview.length > 0" class="preview-section">
          <p class="preview-title">✨ 您指定的需求：</p>
          <div class="issues-tags">
            <span v-for="(issue, idx) in issuesPreview" :key="idx" class="tag">
              {{ issue }}
            </span>
          </div>
        </div>

        <!-- 提交按鈕 -->
        <button type="submit" class="submit-btn" :disabled="loading || !formData.base_skin_type">
          {{ loading ? '提交中...' : '💾 保存個人資料' }}
        </button>
      </form>
    </div>

    <!-- 額外信息區塊 -->
    <div class="info-section">
      <h2>📝 為什麼需要這些信息？</h2>
      <ul>
        <li><strong>膚質類型：</strong>幫助 AI 了解您的皮膚基礎需求（保濕、控油、舒緩等）</li>
        <li><strong>性別：</strong>考慮性別特定的肌膚變化（如激素影響）</li>
        <li><strong>年齡：</strong>針對不同年齡階段提供合適的抗衰老或預防建議</li>
        <li><strong>肌膚問題：</strong>幫助 AI 設計針對性的保養排程，推薦缺失的成分或產品</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserProfile } from '~/stores/useUserProfile';

// ==================
// 使用 Store
// ==================
const userProfileStore = useUserProfile();
const { profile, loading, error, saveSuccess, userAge: computedUserAge } = storeToRefs(userProfileStore);

// ==================
// 響應式資料
// ==================
const currentYear = new Date().getFullYear();

const formData = ref({
  base_skin_type: '',
  gender: '' as 'male' | 'female' | 'other' | '',
  birth_year: null as number | null,
  issues: ''
});

// ==================
// 計算屬性
// ==================
/**
 * 將 issues 字串解析為陣列（預覽用）
 */
const issuesPreview = computed(() => {
  if (!formData.value.issues) return [];
  return formData.value.issues
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
});

// ==================
// 方法
// ==================

/**
 * 載入現有的 profile 資料（如果有的話）
 */
const loadProfileData = () => {
  if (profile.value) {
    formData.value = {
      base_skin_type: profile.value.base_skin_type || '',
      gender: (profile.value.gender as any) || '',
      birth_year: profile.value.birth_year || null,
      issues: profile.value.issues || ''
    };
  }
};

/**
 * 處理表單提交
 */
const handleSubmit = async () => {
  if (!formData.value.base_skin_type) {
    error.value = '膚質類型為必填項';
    return;
  }

  await userProfileStore.updateUserProfile({
    base_skin_type: formData.value.base_skin_type,
    gender: formData.value.gender || null,
    birth_year: formData.value.birth_year || null,
    issues: formData.value.issues || null
  });

  // 如果保存成功，重新載入資料
  if (saveSuccess.value) {
    await userProfileStore.fetchUserProfile();
    loadProfileData();
  }
};

// ==================
// 元件生命週期
// ==================
onMounted(async () => {
  // 首先嘗試從 Store 取得使用者資料
  if (!profile.value) {
    await userProfileStore.fetchUserProfile();
  }
  // 將現有資料填入表單
  loadProfileData();
});
</script>

<style scoped>
.profile-setup-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
  text-align: center;
}

.subtitle {
  color: #7f8c8d;
  text-align: center;
  margin-bottom: 2rem;
}

.form-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-textarea {
  resize: vertical;
}

.help-text {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #7f8c8d;
}

.help-text-block {
  background: #ecf0f1;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  color: #34495e;
}

.help-text-block p {
  margin: 0;
}

.preview-section {
  background: #f0f9ff;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
  border-left: 4px solid #3498db;
}

.preview-title {
  margin: 0 0 0.75rem 0;
  font-weight: 600;
  color: #2c3e50;
}

.issues-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  display: inline-block;
  background: #3498db;
  color: white;
  padding: 0.4rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
}

.submit-btn {
  width: 100%;
  padding: 0.875rem;
  background-color: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background-color: #229954;
}

.submit-btn:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.loading-message,
.error-message,
.success-message {
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  text-align: center;
}

.loading-message {
  background-color: #ecf0f1;
  color: #34495e;
}

.error-message {
  background-color: #fadbd8;
  color: #c0392b;
  border: 1px solid #e74c3c;
}

.success-message {
  background-color: #d5f4e6;
  color: #27ae60;
  border: 1px solid #27ae60;
}

.info-section {
  background: #f8f9fa;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.info-section h2 {
  color: #2c3e50;
  margin-top: 0;
  margin-bottom: 1rem;
}

.info-section ul {
  margin: 0;
  padding-left: 1.5rem;
}

.info-section li {
  margin-bottom: 0.75rem;
  color: #34495e;
  line-height: 1.6;
}

.info-section strong {
  color: #2c3e50;
}
</style>
