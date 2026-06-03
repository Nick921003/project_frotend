import { serverSupabaseUser } from '#supabase/server';
import { getServiceClient } from '~/server/utils/routineAccess';
import { searchUserEmails } from '~/server/utils/userEmails';

/**
 * GET /api/routines/share/search-users?q=<prefix>
 * email 前綴搜尋（≥2 碼），回最多 8 筆、排除自己。
 */
export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

	const q = String(getQuery(event).q || '').trim();
	console.log('[Search User API] query:', q, '| current userId:', userId);
	if (q.length < 2) return { success: true, data: [] };

	const admin = getServiceClient(event);
	const results = await searchUserEmails(admin, q, userId);
	console.log('[Search User API] rpc search results:', results);
	return { success: true, data: results };
});
