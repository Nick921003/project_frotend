<template>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
    <!-- 標題 -->
    <h1 style="color: #333; margin-bottom: 2rem;">個人資料中心</h1>

    <!-- 個人資料修改區塊 -->
    <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
      <h2 style="font-size: 1.2rem; margin-top: 0; color: #555;">📋 基本資料設定</h2>
      
      <form @submit.prevent="handleSubmit">
        <div style="margin-bottom: 15px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">膚質類型：</label>
          <select v-model="formData.skinType" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">未選擇</option>
            <option value="dry">乾性</option>
            <option value="oily">油性</option>
            <option value="combination">混合性</option>
            <option value="sensitive">敏感性</option>
            <option value="normal">中性</option>
          </select>
        </div>

        <div style="margin-bottom: 15px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">年齡群組：</label>
          <select v-model="formData.ageGroup" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">未選擇</option>
            <option value="teens">10-19 歲</option>
            <option value="20s">20-29 歲</option>
            <option value="30s">30-39 歲</option>
            <option value="40s">40-49 歲</option>
            <option value="50plus">50+ 歲</option>
          </select>
        </div>

        <div style="margin-bottom: 15px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">性別：</label>
          <select v-model="formData.gender" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">未選擇</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div style="margin-bottom: 15px;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">肌膚問題或過敏成分：</label>
          <p style="font-size: 12px; color: #666; margin: 5px 0;">可填入肌膚問題（如：痘痘、粉刺、敏感）或對哪些成分過敏（如：酒精、香料等）</p>
          <textarea 
            v-model="formData.issues"
            style="width: 100%; height: 100px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;"
            placeholder="例如：容易長痘、對酒精敏感、害怕重金屬..."
          ></textarea>
        </div>

        <div style="margin-bottom: 15px;">
          <button type="submit" style="padding: 10px 20px; cursor: pointer; background-color: #1890ff; color: white; border: none; border-radius: 4px; font-weight: bold;">
            💾 儲存修改
          </button>
          <span v-if="successMessage" style="color: #27ae60; margin-left: 10px; font-weight: bold;">
            ✅ {{ successMessage }}
          </span>
          <span v-if="errorMessage" style="color: #e74c3c; margin-left: 10px; font-weight: bold;">
            ❌ {{ errorMessage }}
          </span>
        </div>
      </form>
    </div>

    <!-- 保養品庫管理區塊 -->
    <div
      style="background: #fef9e7; padding: 2rem; border-radius: 8px; border: 2px solid #f39c12; margin-bottom: 2rem; cursor: pointer;"
      role="button"
      tabindex="0"
      aria-label="前往保養品庫"
      @click="goCabinet"
      @keydown.enter.prevent="goCabinet"
      @keydown.space.prevent="goCabinet"
    >
      <h2 style="font-size: 1.2rem; margin-top: 0; color: #d68910;">🧴 保養品庫管理</h2>
      <p style="color: #666; margin-bottom: 1rem;">管理你的保養品庫存，上傳成分分析，並在每週排程中使用。</p>
      <router-link to="/cabinet" @click.stop style="display: inline-block; padding: 12px 24px; background-color: #f39c12; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background-color 0.2s;">
        📋 前往保養品庫 →
      </router-link>
    </div>

    <!-- 每週排程區塊 -->
    <div
      style="background: #e8f4f8; padding: 2rem; border-radius: 8px; border: 2px solid #3498db; cursor: pointer;"
      role="button"
      tabindex="0"
      aria-label="前往排程規劃"
      @click="goBeautyPlan"
      @keydown.enter.prevent="goBeautyPlan"
      @keydown.space.prevent="goBeautyPlan"
    >
      <h2 style="font-size: 1.2rem; margin-top: 0; color: #2c3e50;">📅 每週保養排程</h2>
      <p style="color: #666; margin-bottom: 1rem;">建立和管理你的個人保養計劃，使用 AI 推薦或手動排列保養品。</p>
      <router-link to="/beauty-plan" @click.stop style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background-color 0.2s;">
        📅 前往排程規劃 →
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserProfile } from '~/stores/useUserProfile';

type Gender = 'male' | 'female' | 'other' | '';

const userProfileStore = useUserProfile();
const router = useRouter();

const formData = ref({
  skinType: '',
  ageGroup: '',
  gender: '' as Gender,
  issues: ''
});

const successMessage = ref('');
const errorMessage = ref('');

const goCabinet = () => {
  router.push('/cabinet');
};

const goBeautyPlan = () => {
  router.push('/beauty-plan');
};

const fillFormFromStore = () => {
  const profile = userProfileStore.profile;
  if (!profile) return;

  formData.value = {
    skinType: profile.base_skin_type || '',
    ageGroup: profile.age_group || '',
    gender: (profile.gender || '') as Gender,
    issues: profile.issues || ''
  };
};

const handleSubmit = async () => {
  // 驗證
  if (!formData.value.skinType) {
    errorMessage.value = '請選擇膚質類型';
    return;
  }

  try {
    await userProfileStore.updateUserProfile({
      base_skin_type: formData.value.skinType,
      age_group: formData.value.ageGroup || null,
      gender: (formData.value.gender || null) as 'male' | 'female' | 'other' | null,
      issues: formData.value.issues || null
    });

    if (userProfileStore.error) {
      throw new Error(userProfileStore.error);
    }

    await userProfileStore.fetchUserProfile();
    fillFormFromStore();
    
    successMessage.value = '資料已成功保存！';
    errorMessage.value = '';

    // 3 秒後清除成功訊息
    setTimeout(() => {
      successMessage.value = '';
    }, 3000);
  } catch (error: any) {
    console.error('保存失敗:', error);
    errorMessage.value = error.data?.statusMessage || error.message || '保存失敗，請重試';
  }
};

// 在組件掛載時，載入現有的個人資料
onMounted(async () => {
  try {
    await userProfileStore.fetchUserProfile();
    fillFormFromStore();
  } catch (err) {
    console.error('載入個人資料失敗:', err);
  }
});
</script>
