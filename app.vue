<!-- app.vue -->
<template>
  <div>
    <nav class="nav">
      <div class="nav-inner">
        <NuxtLink to="/" class="nav-brand">分析與推薦</NuxtLink>

        <div class="nav-right">
          <div class="nav-menu-wrap">
            <button class="nav-profile-btn" @click="toggleProfileMenu">
              <span class="nav-avatar">👤</span>
              <span>個人資料</span>
            </button>

            <div v-if="showProfileMenu" class="nav-dropdown card">
              <NuxtLink
                to="/profile"
                class="nav-dropdown-item"
                @click="showProfileMenu = false"
              >
                資料修改
              </NuxtLink>
              <NuxtLink
                to="/beauty-plan"
                class="nav-dropdown-item"
                @click="showProfileMenu = false"
              >
                保養規劃
              </NuxtLink>
              <NuxtLink
                v-if="user"
                to="/admin"
                class="nav-dropdown-item"
                @click="showProfileMenu = false"
              >
                後台管理
              </NuxtLink>
              <div class="nav-dropdown-divider"></div>
              <button class="nav-logout-btn" @click="handleLogout">
                登出
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <main class="main-content">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const showProfileMenu = ref(false)
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const toggleProfileMenu = () => {
  showProfileMenu.value = !showProfileMenu.value
}

const handleLogout = async () => {
  try {
    await supabase.auth.signOut()
    showProfileMenu.value = false
    await navigateTo('/login')
  } catch (error) {
    console.error('登出失敗:', error)
  }
}

const closeMenu = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.nav-menu-wrap')) {
    showProfileMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))
</script>

<style scoped>
.nav {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-5);
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  font-family: var(--font-heading);
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  text-decoration: none;
  letter-spacing: 0.02em;
}

.nav-brand:hover {
  color: var(--color-accent);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-menu-wrap {
  position: relative;
}

.nav-profile-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color 0.18s, color 0.18s, background 0.18s;
}

.nav-profile-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-light);
}

.nav-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  padding: var(--space-2) 0;
  z-index: 1000;
}

.nav-dropdown-item {
  display: block;
  padding: var(--space-2) var(--space-4);
  font-size: 14px;
  color: var(--color-text-primary);
  text-decoration: none;
  transition: background 0.15s;
}

.nav-dropdown-item:hover {
  background: var(--color-surface-alt);
  color: var(--color-accent);
}


.nav-dropdown-divider {
  height: 1px;
  background: var(--color-border-light);
  margin: var(--space-2) 0;
}

.nav-logout-btn {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  text-align: left;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-red);
  cursor: pointer;
  transition: background 0.15s;
}

.nav-logout-btn:hover {
  background: var(--color-red-light);
}

.main-content {
  padding: var(--space-6) 0;
}
</style>
