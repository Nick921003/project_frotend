<template>
	<div class="login-wrap">
		<div class="login-card card">
			<h2 class="login-title">{{ isLoginMode ? '會員登入' : '註冊專屬保養帳號' }}</h2>

			<div class="form-group">
				<label class="form-label" for="username">
					{{ isLoginMode ? '帳號 (英文數字 或 Email)' : '自訂帳號 (限英文與數字)' }}
				</label>
				<input
					id="username"
					v-model="usernameInput"
					type="text"
					class="form-input"
					:placeholder="isLoginMode ? '請輸入帳號或 Email' : '例如: user123'"
				/>
			</div>

			<div class="form-group">
				<label class="form-label" for="password">密碼</label>
				<input
					id="password"
					v-model="password"
					type="password"
					class="form-input"
					placeholder="請輸入密碼"
				/>
			</div>

			<div v-if="!isLoginMode" class="form-group">
				<label class="form-label" for="skinType">基礎膚質</label>
				<select id="skinType" v-model="baseSkinType" class="form-input">
					<option value="oily">油性肌膚</option>
					<option value="dry">乾性肌膚</option>
					<option value="combination">混合性肌膚</option>
					<option value="sensitive">敏感性肌膚</option>
					<option value="normal">中性肌膚</option>
				</select>
			</div>

			<button
				class="btn btn-primary btn-lg login-btn"
				:disabled="isLoading"
				@click="handleAuth"
			>
				{{ isLoading ? '處理中...' : (isLoginMode ? '登入' : '註冊') }}
			</button>

			<!-- 訪客一鍵體驗按鈕 -->
			<button
				v-if="isLoginMode"
				class="btn btn-secondary btn-lg login-btn guest-btn"
				:disabled="isLoading"
				@click="handleGuestLogin"
			>
				訪客一鍵體驗登入
			</button>

			<p v-if="errorMsg" class="login-error">{{ errorMsg }}</p>

			<div class="login-divider"><span>或</span></div>

			<button class="btn btn-secondary btn-lg login-btn" :disabled="isLoading" @click="handleGoogleLogin">
				用 Google 帳號登入
			</button>

			<p v-if="isLoginMode && registrationEnabled" class="login-toggle" @click="isLoginMode = false">
				沒有帳號？點此註冊
			</p>
			<p v-else-if="!isLoginMode" class="login-toggle" @click="isLoginMode = true">
				已有帳號？點此登入
			</p>
			<p v-else class="login-closed">目前暫停開放新用戶註冊</p>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const supabase = useSupabaseClient()

const isLoginMode = ref(true)
const isLoading = ref(false)
const errorMsg = ref('')
const registrationEnabled = ref(true)

const usernameInput = ref('')
const password = ref('')
const baseSkinType = ref('oily')

// 虛擬信箱後綴，用以符合 Supabase Auth 的 Email 格式
const VIRTUAL_DOMAIN = '@beautyanalyzer.local'

onMounted(async () => {
	try {
		const res = await $fetch('/api/auth/registration-status')
		registrationEnabled.value = res.enabled
	} catch {
		registrationEnabled.value = true
	}
})

const handleGoogleLogin = async () => {
	isLoading.value = true
	errorMsg.value = ''
	try {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${window.location.origin}/` }
		})
		if (error) throw error
	} catch (error) {
		errorMsg.value = error.message
		isLoading.value = false
	}
}

// 處理自訂登入或註冊
const handleAuth = async () => {
	if (!usernameInput.value || !password.value) {
		errorMsg.value = '請填寫完整資訊'
		return
	}

	isLoading.value = true
	errorMsg.value = ''

	// 處理自訂帳號轉虛擬 Email
	let finalEmail = usernameInput.value.trim()
	if (!finalEmail.includes('@')) {
		// 驗證僅限英文、數字與底線
		const usernameRegex = /^[a-zA-Z0-9_]+$/
		if (!usernameRegex.test(finalEmail)) {
			errorMsg.value = '帳號只能包含英文、數字或底線'
			isLoading.value = false
			return
		}
		finalEmail = `${finalEmail}${VIRTUAL_DOMAIN}`
	}

	try {
		if (isLoginMode.value) {
			// 登入邏輯
			const { error } = await supabase.auth.signInWithPassword({
				email: finalEmail,
				password: password.value,
			})
			if (error) throw error

			alert('登入成功！')
			await navigateTo('/')
		} else {
			// 註冊邏輯
			const { error } = await supabase.auth.signUp({
				email: finalEmail,
				password: password.value,
				options: {
					data: { base_skin_type: baseSkinType.value }
				}
			})

			if (error) throw error

			alert('註冊成功！資料庫已自動為您建立專屬膚質檔案。')
			
			// 註冊成功後自動幫用戶登入
			const { error: loginErr } = await supabase.auth.signInWithPassword({
				email: finalEmail,
				password: password.value,
			})
			if (!loginErr) {
				await navigateTo('/')
			} else {
				isLoginMode.value = true
			}
		}
	} catch (error) {
		errorMsg.value = error.message
	} finally {
		isLoading.value = false
	}
}

// 處理訪客一鍵體驗登入
const handleGuestLogin = async () => {
	isLoading.value = true
	errorMsg.value = ''

	// 使用隨機 6 位字串，確保多人同時體驗時帳號完全隔離、互不干擾
	const randomSuffix = Math.random().toString(36).substring(2, 8)
	const guestEmail = `guest_${randomSuffix}${VIRTUAL_DOMAIN}`
	const guestPassword = 'guestPassword123'

	try {
		// 1. 直接在背景為此臨時訪客註冊新帳號
		const { error: signUpError } = await supabase.auth.signUp({
			email: guestEmail,
			password: guestPassword,
			options: {
				data: { base_skin_type: 'normal' } // 訪客預設為中性肌
			}
		})
		if (signUpError) throw signUpError

		// 2. 註冊成功後自動登入
		const { error: signInError } = await supabase.auth.signInWithPassword({
			email: guestEmail,
			password: guestPassword,
		})
		if (signInError) throw signInError

		alert('已使用獨立訪客帳號一鍵登入！請先設定您的基本資料與膚況，以啟用個人化地雷成分警告與排程建議。')
		await navigateTo('/profile?from=guest')
	} catch (error) {
		errorMsg.value = '訪客登入失敗: ' + error.message
	} finally {
		isLoading.value = false
	}
}
</script>

<style scoped>
.login-wrap {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--space-5);
}

.login-card {
	width: 100%;
	max-width: 400px;
}

.login-title {
	font-size: 22px;
	margin-bottom: var(--space-6);
	text-align: center;
}

.login-btn {
	width: 100%;
	margin-top: var(--space-2);
}

.guest-btn {
	background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%);
	border: 1px solid var(--color-accent, #3b82f6);
	color: var(--color-accent, #1e3a8a);
	font-weight: 600;
	margin-top: var(--space-3);
}

.guest-btn:hover {
	background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%);
}

.login-error {
	margin-top: var(--space-3);
	font-size: 14px;
	color: var(--color-red);
	text-align: center;
}

.login-toggle {
	margin-top: var(--space-4);
	text-align: center;
	font-size: 14px;
	color: var(--color-text-secondary);
	cursor: pointer;
	margin-bottom: 0;
}

.login-toggle:hover {
	color: var(--color-accent);
}

.login-closed {
	margin-top: var(--space-4);
	text-align: center;
	font-size: 13px;
	color: #999;
	margin-bottom: 0;
}

.login-divider {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	margin: var(--space-4) 0 var(--space-2);
	color: var(--color-text-secondary);
	font-size: 13px;
}
.login-divider::before,
.login-divider::after {
	content: '';
	flex: 1;
	height: 1px;
	background: var(--color-border);
}
</style>
