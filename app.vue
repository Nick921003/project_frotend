<!-- app.vue -->
<template>
  <div>
    <!-- 導航欄 -->
    <nav style="background-color: #f0f0f0; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <NuxtLink to="/">首頁</NuxtLink>
      </div>

      <!-- 個人資料下拉菜單 -->
      <div style="position: relative;">
        <button 
          @click="toggleProfileMenu"
          style="padding: 8px 12px; cursor: pointer;"
        >
          👤 個人資料
        </button>

        <!-- 下拉菜單 -->
        <div 
          v-if="showProfileMenu"
          style="
            position: absolute;
            top: 100%;
            right: 0;
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            min-width: 150px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 1000;
          "
        >
          <NuxtLink 
            to="/profile"
            @click="showProfileMenu = false"
            style="display: block; padding: 10px 15px; text-decoration: none; color: #333; border-bottom: 1px solid #eee;"
          >
            資料修改
          </NuxtLink>

          <NuxtLink 
            to="/beauty-plan"
            @click="showProfileMenu = false"
            style="display: block; padding: 10px 15px; text-decoration: none; color: #333;"
          >
            保養規劃
          </NuxtLink>

          <button
            @click="handleLogout"
            style="
              width: 100%;
              padding: 10px 15px;
              background: none;
              border: none;
              border-top: 1px solid #eee;
              text-align: left;
              cursor: pointer;
              color: #d32f2f;
            "
          >
            登出
          </button>
        </div>
      </div>
    </nav>

    <!-- 頁面內容 -->
    <main style="padding: 20px;">
      <NuxtPage /> <!-- 這是最關鍵的一行，用來渲染 pages/ 裡面的頁面 -->
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const showProfileMenu = ref(false);
const supabase = useSupabaseClient();

const toggleProfileMenu = () => {
  showProfileMenu.value = !showProfileMenu.value;
};

const handleLogout = async () => {
  try {
    await supabase.auth.signOut();
    showProfileMenu.value = false;
    await navigateTo('/login');
  } catch (error) {
    console.error('登出失敗:', error);
  }
};

// 點擊菜單外部時關閉菜單
const closeMenu = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('nav')) {
    showProfileMenu.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenu);
});
</script>