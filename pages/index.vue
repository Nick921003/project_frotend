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
      <input type="file" accept="image/jpeg, image/png, image/webp" @change="handleImageUpload" :disabled="isLoading" />
      
      <div v-if="imageBase64" style="margin-top: 10px;">
        <img :src="imageBase64" alt="預覽" style="max-height: 150px; border-radius: 4px;" />
      </div>
    </div>

    <!-- 3. 送出按鈕 -->
    <button 
      @click="analyzeIngredients" 
      :disabled="!imageBase64 || isLoading"
      style="width: 100%; padding: 12px; background: #000; color: #fff; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;"
    >
      {{ isLoading ? '🤖 AI 與資料庫比對中...' : '開始分析成分' }}
    </button>

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

      <!-- 儲存至保養品櫃區塊 (限會員) -->
      <div v-if="user" style="margin-top: 20px; padding: 15px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 8px;">
        <h4 style="margin-top: 0;">💾 儲存至我的保養櫃</h4>
        <input v-model="productName" type="text" placeholder="請輸入產品名稱 (例如：寶拉珍選水楊酸)" style="width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box; border-radius: 4px; border: 1px solid #ddd;" />
        <button 
          @click="saveToCabinet" 
          :disabled="isSaving"
          style="width: 100%; padding: 10px; background: #1890ff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;"
        >
          {{ isSaving ? '儲存中...' : '將此產品加入保養庫' }}
        </button>
      </div>
      <div v-else style="margin-top: 20px; text-align: center; color: #666; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p>登入會員即可將產品儲存至專屬保養庫，並解鎖一週排程分析！</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, watchEffect } from 'vue'

// Supabase Composables
const user = useSupabaseUser()
const supabase = useSupabaseClient()

// 狀態管理
const selectedSkinType = ref('oily') // 訪客預設值
const imageBase64 = ref(null)
const isLoading = ref(false)
const result = ref(null)
const errorMsg = ref(null)

// 儲存至保養庫專用狀態
const productName = ref('')
const isSaving = ref(false)

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
  
  try {
    const res = await $fetch('/api/analyze', {
      method: 'POST',
      body: {
        imageBase64: imageBase64.value,
        skinType: selectedSkinType.value // 動態傳入使用者選擇的膚質
      }
    })
    
    result.value = res
    console.log('✅ 完整工作流測試成功:', res)

  } catch (error) {
    console.error('❌ API 請求失敗:', error)
    errorMsg.value = error.data?.statusMessage || error.message || '發生未知的錯誤'
  } finally {
    isLoading.value = false
  }
}

// [新增邏輯]：儲存到保養品櫃
const saveToCabinet = async () => {
  if (!productName.value) {
    alert('請輸入產品名稱')
    return
  }

  isSaving.value = true
  try {
    const res = await $fetch('/api/cabinet/save', {
      method: 'POST',
      body: {
        productName: productName.value,
        productCategory: '保養品', // 未來你可以做成下拉選單讓使用者選精華液、乳霜等
        rawIngredients: result.value.data.rawAiOutput,
        analysisResult: result.value.data.analysis // 包含紅黃綠燈的 JSON
      }
    })
    alert('✅ 儲存成功！')
    console.log(res)
    productName.value = '' // 清空輸入框
  } catch (error) {
    alert('❌ 儲存失敗：' + (error.data?.statusMessage || error.message))
  } finally {
    isSaving.value = false
  }
}

// 登出功能
const handleLogout = async () => {
  await supabase.auth.signOut()
  result.value = null
  alert('已登出')
}
</script>