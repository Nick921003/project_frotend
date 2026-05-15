import heicConvert from 'heic-convert'

/**
 * POST /api/convert-heic
 * 接收 multipart HEIC，用 heic-convert（WASM libheif，支援現代 HEVC HEIC）轉成 JPEG
 * 回傳 base64 data URL，不寫暫存檔
 *
 * 備注：sharp 和 ffmpeg 的預編譯 binary 均無 HEVC decode 支援，故改用純 JS 方案
 */
export default defineEventHandler(async (event) => {
	const parts = await readMultipartFormData(event)
	const filePart = parts?.find(p => p.name === 'file')

	if (!filePart?.data?.length) {
		throw createError({ statusCode: 400, statusMessage: '缺少檔案資料' })
	}

	try {
		const jpegBuffer = await heicConvert({
			buffer: filePart.data,
			format: 'JPEG',
			quality: 0.85,
		})

		const base64 = Buffer.from(jpegBuffer).toString('base64')
		return { base64: `data:image/jpeg;base64,${base64}` }
	} catch (err: any) {
		console.error('[convert-heic] heic-convert 轉換失敗:', err?.message)
		throw createError({ statusCode: 422, statusMessage: `HEIC 轉換失敗: ${err?.message}` })
	}
})
