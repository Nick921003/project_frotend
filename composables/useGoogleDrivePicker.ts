import { ref } from 'vue';

// Google Drive Picker 選取圖片
// token 存在記憶體，關頁面消失；重新選取才會再授權
export function useGoogleDrivePicker() {
	const config = useRuntimeConfig()
	const _token = ref<string | null>(null)

	// 動態載入 gapi + Google Identity Services，避免影響頁面啟動速度
	const _loadScripts = (): Promise<void> => {
		return new Promise((resolve) => {
			const win = window as any
			let gapiReady = !!(win.gapi?.picker)
			let gisReady = !!(win.google?.accounts?.oauth2)

			if (gapiReady && gisReady) { resolve(); return }

			const check = () => { if (gapiReady && gisReady) resolve() }

			if (!gapiReady) {
				if (win.gapi) {
					win.gapi.load('picker', () => { gapiReady = true; check() })
				} else {
					const s = document.createElement('script')
					s.src = 'https://apis.google.com/js/api.js'
					s.onload = () => win.gapi.load('picker', () => { gapiReady = true; check() })
					document.head.appendChild(s)
				}
			}

			if (!gisReady) {
				const s = document.createElement('script')
				s.src = 'https://accounts.google.com/gsi/client'
				s.onload = () => { gisReady = true; check() }
				document.head.appendChild(s)
			}
		})
	}

	// 取得 Google OAuth token（Drive readonly scope）
	const _getToken = (): Promise<string> => {
		if (_token.value) return Promise.resolve(_token.value)
		return new Promise((resolve, reject) => {
			const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
				client_id: config.public.googleClientId,
				scope: 'https://www.googleapis.com/auth/drive.readonly',
				callback: (res: any) => {
					if (res.error) { reject(new Error(res.error)); return }
					_token.value = res.access_token
					resolve(res.access_token)
				}
			})
			tokenClient.requestAccessToken({ prompt: '' })
		})
	}

	// 壓縮 Blob 至長邊 2048px，JPEG 0.85
	const _compress = (blob: Blob): Promise<string> => {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(blob)
			const img = new Image()
			img.onload = () => {
				const MAX = 2048
				let width = img.naturalWidth
				let height = img.naturalHeight
				if (width > MAX || height > MAX) {
					if (width >= height) { height = Math.round(height * MAX / width); width = MAX }
					else { width = Math.round(width * MAX / height); height = MAX }
				}
				const canvas = document.createElement('canvas')
				canvas.width = width
				canvas.height = height
				canvas.getContext('2d').drawImage(img, 0, 0, width, height)
				URL.revokeObjectURL(url)
				resolve(canvas.toDataURL('image/jpeg', 0.85))
			}
			img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片壓縮失敗')) }
			img.src = url
		})
	}

	const openPicker = async (
		onPicked: (base64: string) => void,
		onError?: (msg: string) => void
	) => {
		try {
			await _loadScripts()
			const token = await _getToken()
			const win = window as any

			new win.google.picker.PickerBuilder()
				.addView(win.google.picker.ViewId.DOCS_IMAGES)
				.enableFeature(win.google.picker.Feature.MULTISELECT_ENABLED)
				.setOAuthToken(token)
				.setDeveloperKey(config.public.googleApiKey)
				.setCallback(async (data: any) => {
					if (data.action !== win.google.picker.Action.PICKED) return
					// 多選：逐一下載壓縮
					for (const file of data.docs) {
						const resp = await fetch(
							`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
							{ headers: { Authorization: `Bearer ${token}` } }
						)
if (!resp.ok) { onError?.(`Drive 下載失敗（${resp.status}）`); continue }

						const contentType = resp.headers.get('content-type') || ''
						if (contentType.includes('text/html')) {
							onError?.('此檔案無法直接下載，請確認格式為 JPEG 或 PNG。')
							continue
						}

						const buffer = await resp.arrayBuffer()
						const mimeType = contentType.split(';')[0] || 'image/jpeg'
						// Google Drive 可能對 HEIC 回傳 application/octet-stream，需強制正確 type
						const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif' ||
							!!(file.name || '').toLowerCase().match(/\.(heic|heif)$/)
						const effectiveMime = isHeic ? 'image/heic' : mimeType
						const blob = new Blob([buffer], { type: effectiveMime })

						let base64: string
						if (isHeic) {
							// 先取得原始 HEIC base64
							const heicBase64 = await new Promise<string>((res, rej) => {
								const reader = new FileReader()
								reader.onload = (e) => res(e.target!.result as string)
								reader.onerror = () => rej(new Error('HEIF 讀取失敗'))
								reader.readAsDataURL(blob)
							})
							try {
								// 送伺服器端用 sharp 轉 JPEG（支援現代 HEVC HEIC）
								const form = new FormData()
								form.append('file', blob, 'image.heic')
								const result = await $fetch<{ base64: string }>('/api/convert-heic', {
									method: 'POST',
									body: form
								})
								base64 = result.base64
							} catch {
								// 轉換失敗：回退 HEIC base64（Gemini 仍可分析，preview 顯示佔位框）
								base64 = heicBase64
							}
						} else {
							base64 = await _compress(blob)
						}
						onPicked(base64)
					}
				})
				.build()
				.setVisible(true)
		} catch (e: any) {
			if (e.message?.includes('invalid_grant') || e.message?.includes('Token')) {
				_token.value = null
			}
			onError?.(e.message || 'Google Drive 選取失敗')
		}
	}

	return { openPicker }
}
