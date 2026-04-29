<template>
  <div class="admin-wrap">
    <h1>後台管理</h1>

    <div v-if="loading" class="status-box">載入中...</div>
    <div v-else-if="forbidden" class="status-box status-error">⛔ 無權限存取此頁面</div>

    <template v-else>
      <!-- 系統設定 -->
      <div class="admin-card">
        <h2>系統設定</h2>

        <div class="setting-row">
          <div>
            <div class="setting-label">開放新用戶註冊</div>
            <div class="setting-desc">關閉後，登入頁將隱藏註冊入口</div>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              v-model="registrationEnabled"
              @change="saveSetting('registration_enabled', registrationEnabled)"
            />
            <span class="slider"></span>
          </label>
        </div>

        <p v-if="saveMsg" class="save-msg">{{ saveMsg }}</p>
      </div>

      <!-- 今日訪客統計 -->
      <div class="admin-card">
        <div class="card-header">
          <h2>今日訪客分析統計</h2>
          <button class="btn-refresh" @click="fetchStats">重新整理</button>
        </div>

        <div class="stats-summary">
          <span>日期：{{ stats.date }}</span>
          <span>總次數：<strong>{{ stats.totalRequests }}</strong></span>
          <span>不重複 IP：<strong>{{ stats.byIp.length }}</strong></span>
        </div>

        <table v-if="stats.byIp.length > 0" class="stats-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>使用次數</th>
              <th>剩餘</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in stats.byIp" :key="row.ip">
              <td class="ip-cell">{{ row.ip }}</td>
              <td>{{ row.count }}</td>
              <td :class="row.count >= 3 ? 'exhausted' : 'remaining'">
                {{ row.count >= 3 ? '已達上限' : `${3 - row.count} 次` }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty-msg">今日尚無訪客分析記錄</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const router = useRouter()
const supabaseUser = useSupabaseUser()

const loading = ref(true)
const forbidden = ref(false)
const saveMsg = ref('')

const registrationEnabled = ref(true)

const stats = ref<{ date: string; totalRequests: number; byIp: { ip: string; count: number }[] }>({
  date: '',
  totalRequests: 0,
  byIp: []
})

const fetchSettings = async () => {
  const res = await $fetch<{ success: boolean; data: { key: string; value: string }[] }>('/api/admin/settings')
  const regSetting = res.data.find(s => s.key === 'registration_enabled')
  registrationEnabled.value = regSetting?.value !== 'false'
}

const fetchStats = async () => {
  const res = await $fetch<{ success: boolean; date: string; totalRequests: number; byIp: any[] }>('/api/admin/stats')
  stats.value = res
}

const saveSetting = async (key: string, value: boolean) => {
  saveMsg.value = ''
  await $fetch('/api/admin/settings', {
    method: 'POST',
    body: { key, value: String(value) }
  })
  saveMsg.value = '✅ 已儲存'
  setTimeout(() => { saveMsg.value = '' }, 2500)
}

onMounted(async () => {
  if (!supabaseUser.value) {
    router.push('/login')
    return
  }

  try {
    await Promise.all([fetchSettings(), fetchStats()])
  } catch (err: any) {
    if (err.status === 403 || err.statusCode === 403) {
      forbidden.value = true
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.admin-wrap {
  max-width: 720px;
  margin: 2rem auto;
  padding: 1.5rem;
}

h1 {
  font-size: 1.75rem;
  margin-bottom: 1.5rem;
  color: #1f2937;
}

.status-box {
  padding: 1rem;
  border-radius: 6px;
  background: #f3f4f6;
  text-align: center;
}

.status-error {
  background: #fef2f2;
  color: #991b1b;
  font-weight: 600;
}

.admin-card {
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.admin-card h2 {
  margin: 0 0 1.25rem;
  font-size: 1.1rem;
  color: #374151;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-header h2 { margin: 0; }

.btn-refresh {
  padding: 0.35rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-refresh:hover { background: #f3f4f6; }

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-top: 1px solid #f3f4f6;
}

.setting-label { font-weight: 600; font-size: 0.95rem; }
.setting-desc { font-size: 0.8rem; color: #6b7280; margin-top: 2px; }

.save-msg {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #16a34a;
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle input { opacity: 0; width: 0; height: 0; }

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #d1d5db;
  border-radius: 24px;
  transition: 0.2s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: 0.2s;
}

.toggle input:checked + .slider { background: #667eea; }
.toggle input:checked + .slider::before { transform: translateX(20px); }

/* Stats table */
.stats-summary {
  display: flex;
  gap: 1.5rem;
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.stats-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

.stats-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.ip-cell { font-family: monospace; font-size: 0.85rem; }

.exhausted { color: #ef4444; font-weight: 600; }
.remaining { color: #16a34a; }

.empty-msg {
  color: #9ca3af;
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem 0;
}
</style>
