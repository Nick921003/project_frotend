import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Email 前綴搜尋（service-key 呼叫 SECURITY DEFINER RPC）。
 * 呼叫端傳入已建好的 service-key admin client，避免重複建立。
 */
export async function searchUserEmails(
	admin: SupabaseClient,
	prefix: string,
	excludeUserId: string
): Promise<{ user_id: string; email: string }[]> {
	if (prefix.length < 2) return [];
	const { data, error } = await (admin as any).rpc('search_user_emails', { prefix });
	if (error) throw createError({ statusCode: 500, statusMessage: 'Email 搜尋失敗: ' + error.message });
	return (data || [])
		.filter((r: any) => r.user_id !== excludeUserId)
		.slice(0, 8)
		.map((r: any) => ({ user_id: r.user_id, email: r.email }));
}

/**
 * 批次把 user_id → email（給分享列表 / 「誰分享的」用）。
 * 呼叫端傳入已建好的 service-key admin client，避免重複建立。
 */
export async function getUserEmails(
	admin: SupabaseClient,
	ids: string[]
): Promise<Record<string, string>> {
	const unique = Array.from(new Set(ids)).filter(Boolean);
	if (unique.length === 0) return {};
	const { data, error } = await (admin as any).rpc('get_user_emails', { ids: unique });
	if (error) throw createError({ statusCode: 500, statusMessage: 'Email 反解失敗: ' + error.message });
	const map: Record<string, string> = {};
	for (const r of (data || [])) map[r.user_id] = r.email;
	return map;
}
