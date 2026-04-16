<template>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
    
    <!-- 頂部登入狀態列 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #eee; padding: 10px; border-radius: 8px;">
      <span v-if="user">👤 會員已登入 (綁定膚質: {{ selectedSkinType }})</span>
      <span v-else>👻 訪客模式</span>
      
      <div>
        <button v-if="user" @click="handleLogout" style="margin-left: 10px; padding: 6px 12px; background: #ff7875; color: #fff; border: none; border-radius: 4px; cursor: pointer;">登出</button>
        <button v-else @click="navigateTo('/login')" style="margin-left: 10px; padding: 6px 12px; background: #1890ff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">前往登入</button>
      </div>
    </div>

    <h2>🧴 保養品成分分析</h2>

    <!-- 1. 膚質設定區 (只有訪客可以手動選，會員會被 readonly 鎖定並顯示其設定) -->
    <div style="margin-bottom: 20px; padding: 15px; background: #f0f8ff; border-radius: 8px;">
      <label style="font-weight: bold; display: block; margin-bottom: 8px;">步驟 1：確認您的膚質</label>
      <select v-model="selectedSkinType" :disabled="!!user" style="padding: 8px; width: 100%; border-radius: 4px;">
        <option value="oily">油性肌膚 (Oily) - 容易出油、長痘</option>
        <option value="dry">乾性肌膚 (Dry) - 容易緊繃、脫屑</option>
        <option value="combination">混合性肌膚 (Combination) - T字油、兩頰乾</option>
        <option value="sensitive">敏感性肌膚 (Sensitive) - 容易泛紅、刺痛</option>
        <option value="normal">中性肌膚 (Normal) - 油水分泌平衡</option>
      </select>
      <small v-if="user" style="color: #666; margin-top: 5px; display: block;">*已自動套用您的會員膚質設定</small>
    </div>

    <!-- 2. 圖片上傳區 -->
    <div style="margin-bottom: 20px; padding: 15px; border: 2px dashed #ccc; border-radius: 8px;">
      <label style="font-weight: bold; display: block; margin-bottom: 8px;">步驟 2：上傳成分表照片</label>

      <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 10px;">
        <input
          v-model="productName"
          type="text"
          placeholder="產品名稱（可不填，系統會自動命名）"
          :disabled="isLoading"
          style="padding: 8px; border-radius: 4px; border: 1px solid #ddd;"
        />

        <select
          v-model="productCategory"
          :disabled="isLoading"
          style="padding: 8px; border-radius: 4px; border: 1px solid #ddd;"
        >
          <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>

      <input type="file" accept="image/jpeg, image/png, image/webp" @change="handleImageUpload" :disabled="isLoading" />
      
      <div v-if="imageBase64" style="margin-top: 10px;">
        <img :src="imageBase64" alt="預覽" style="max-height: 150px; border-radius: 4px;" />
      </div>

      <p v-if="fromRoutine" style="margin-top: 10px; font-size: 0.85em; color: #2563eb;">
        來自排程頁：分析並加入保養品櫃後，將自動返回原排程頁。
      </p>
    </div>

    <!-- 3. 送出按鈕 -->
    <button 
      @click="analyzeIngredients" 
      :disabled="!imageBase64 || isLoading"
      style="width: 100%; padding: 12px; background: #000; color: #fff; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;"
    >
      {{ isLoading ? '🤖 AI 分析與保存中...' : '開始分析成分並加入保養品櫃' }}
    </button>

    <div v-if="saveMsg" style="margin-top: 12px; padding: 10px; background: #ecfdf3; color: #166534; border: 1px solid #86efac; border-radius: 6px;">
      {{ saveMsg }}
    </div>

    <!-- 錯誤訊息 -->
    <div v-if="errorMsg" style="margin-top: 20px; padding: 10px; background: #ffebee; color: #c62828; border-radius: 4px;">
      ❌ {{ errorMsg }}
    </div>

    <!-- 4. 分析結果區塊 -->
    <div v-if="result?.data?.analysis" style="margin-top: 30px;">
      <h3>📊 分析報告</h3>
      
      <!-- 🔴 法規紅燈區 -->
      <div v-if="result.data.analysis.regulatoryAlerts.length > 0" style="margin-bottom: 15px; padding: 15px; background: #fff0f0; border-left: 5px solid #ff4d4f; border-radius: 4px;">
        <h4 style="margin-top: 0; color: #cf1322;">🔴 法規警告 (限量/禁用成分)</h4>
        <ul style="margin-bottom: 0; padding-left: 20px;">
          <li v-for="item in result.data.analysis.regulatoryAlerts" :key="item.inci_name" style="margin-bottom: 8px;">
            <strong>{{ item.inci_name }}</strong><br/>
            <span style="font-size: 0.9em; color: #666;">規定：{{ item.warning || item.limit }}</span>
          </li>
        </ul>
      </div>

      <!-- 🟡 膚質黃燈區 -->
      <div v-if="result.data.analysis.skinTypeAlerts.length > 0" style="margin-bottom: 15px; padding: 15px; background: #fffbe6; border-left: 5px solid #faad14; border-radius: 4px;">
        <h4 style="margin-top: 0; color: #d48806;">🟡 膚質地雷 (針對 {{ selectedSkinType }})</h4>
        <ul style="margin-bottom: 0; padding-left: 20px;">
          <li v-for="item in result.data.analysis.skinTypeAlerts" :key="item.inci_name" style="margin-bottom: 8px;">
            <strong>{{ item.inci_name }}</strong><br/>
            <span style="font-size: 0.9em; color: #666;">風險：{{ item.risk_description }}</span>
          </li>
        </ul>
      </div>

      <!-- 🟢 安全/未知區 -->
      <div style="padding: 15px; background: #f6ffed; border-left: 5px solid #52c41a; border-radius: 4px; margin-bottom: 15px;">
        <h4 style="margin-top: 0; color: #389e0d;">🟢 一般成分 (未觸發警報)</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span v-for="name in result.data.analysis.safeList" :key="name" style="background: #e6f7ff; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">
            {{ name }}
          </span>
          <span v-if="result.data.analysis.safeList.length === 0" style="color: #999; font-size: 0.9em;">無</span>
        </div>
      </div>

      <!-- 💡 AI 綜合評估區 -->
      <div v-if="result.data.overallSummary" style="margin-bottom: 20px; padding: 15px; background: #f3f0ff; border-left: 5px solid #722ed1; border-radius: 4px;">
        <h4 style="margin-top: 0; color: #531dab;">✨ AI 配方師總評</h4>
        <p style="line-height: 1.6; margin-bottom: 0;">{{ result.data.overallSummary }}</p>
      </div>

      <!-- 提示：前往個人資料保管理保養品 -->
      <div v-if="user" style="margin-top: 20px; padding: 15px; background: #e6f7ff; border: 1px solid #91d5ff; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #0050b3;">💡 要將此產品加入保養庫？請前往 <router-link to="/profile-setup" style="font-weight: bold; color: #1890ff; text-decoration: none;">個人資料</router-link> 管理您的保養品庫存</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { onMounted, ref, watchEffect } from 'vue'
import { PRODUCT_CATEGORIES, resolveProductCategory } from '~/utils/productCategories'

// Supabase Composables
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()

// 狀態管理
const selectedSkinType = ref('oily') // 訪客預設值
const imageBase64 = ref(null)
const isLoading = ref(false)
const result = ref(null)
const errorMsg = ref(null)
const saveMsg = ref('')
const fromRoutine = ref(false)
const returnRoutineId = ref('')
const productName = ref('')
const productCategory = ref('其他')

const categoryOptions = PRODUCT_CATEGORIES

// [核心邏輯]：監聽使用者狀態，若登入則去 profiles 撈取他的專屬膚質
watchEffect(async () => {
  if (user.value) {
    // JWT token 中用戶 ID 應該在 sub 或 id 欄位
    const userId = user.value.sub || user.value.id
    
    if (!userId) {
      console.error('❌ 無法取得用戶 ID，user 物件:', user.value)
      return
    }
    
    console.log('✅ 成功取得用戶 ID:', userId)
    
    const { data, error } = await supabase
      .from('profiles')
      .select('base_skin_type')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.warn('⚠️  查詢 profiles 表失敗:', error)
      return
    }
      
    if (data?.base_skin_type) {
      console.log('✅ 從 profiles 取得膚質:', data.base_skin_type)
      selectedSkinType.value = data.base_skin_type
    }
  }
})

// 處理圖片上傳轉 Base64
const handleImageUpload = (event) => {
  errorMsg.value = null
  const file = event.target.files[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    errorMsg.value = '圖片檔案過大，請上傳小於 5MB 的照片。'
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => { imageBase64.value = e.target.result }
  reader.onerror = () => { errorMsg.value = '圖片讀取失敗，請重試。' }
  reader.readAsDataURL(file)
}

// 呼叫 API 進行完整分析
const analyzeIngredients = async () => {
  if (!imageBase64.value) return

  isLoading.value = true
  result.value = null
  errorMsg.value = null
  saveMsg.value = ''
  
  try {
    const res = await $fetch('/api/analyze', {
      method: 'POST',
      body: {
        imageBase64: imageBase64.value,
        skinType: selectedSkinType.value // 動態傳入使用者選擇的膚質
      },
      timeout: 60000
    })
    
    result.value = res
    console.log('✅ 完整工作流測試成功:', res)

    if (!user.value) {
      saveMsg.value = '⚠️ 已分析完成。請先登入後再加入保養品櫃。'
      return
    }

    const finalName = productName.value?.trim() || `未命名產品 ${new Date().toLocaleDateString('zh-TW')}`
    const finalCategory = productCategory.value || '其他'
    const rawIngredients = JSON.stringify(res?.data?.rawAiOutput || [])

    await $fetch('/api/cabinet/save', {
      method: 'POST',
      body: {
        productName: finalName,
        productCategory: finalCategory,
        rawIngredients,
        analysisResult: res?.data || null
      },
      timeout: 30000
    })

    saveMsg.value = '✅ 已加入保養品櫃'

    if (fromRoutine.value && returnRoutineId.value) {
      setTimeout(() => {
        router.push({
          path: `/routines/${returnRoutineId.value}`,
          query: {
            cabinetUpdated: '1'
          }
        })
      }, 600)
    }

  } catch (error) {
    console.error('❌ API 請求失敗:', error)
    errorMsg.value = error.data?.statusMessage || error.message || '發生未知的錯誤'
  } finally {
    isLoading.value = false
  }
}

// 登出功能
const handleLogout = async () => {
  await supabase.auth.signOut()
  result.value = null
  alert('已登出')
}

onMounted(() => {
  const from = typeof route.query.from === 'string' ? route.query.from : ''
  const routineId = typeof route.query.routineId === 'string' ? route.query.routineId : ''
  const categoryHint = typeof route.query.category === 'string' ? route.query.category : ''

  fromRoutine.value = from === 'routine' && !!routineId
  returnRoutineId.value = routineId

  if (categoryHint) {
    const resolvedHint = resolveProductCategory(categoryHint)
    if (resolvedHint) {
      productCategory.value = resolvedHint
    } else {
      productName.value = categoryHint
    }
  }
})
</script>