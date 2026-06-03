import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { getServiceClient } from '~/server/utils/routineAccess';
import { getUserEmails } from '~/server/utils/userEmails';

/**
 * GET /api/routines/list
 * 回傳：自己擁有的排程 + 別人分享給我（status=active）的排程。
 * 每筆附 _share（共享來源/權限/狀態，自有為 null）與 _is_active_for_me。
 */
export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });

	const supabase = await serverSupabaseClient(event);

	// 1. 自己擁有的（user client 即可）
	const { data: owned, error: ownedErr } = await (supabase as any)
		.from('routines')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });
	if (ownedErr) throw createError({ statusCode: 500, statusMessage: '查詢排程列表失敗: ' + ownedErr.message });

	// 2. 我的啟動指標
	const { data: activeRow } = await (supabase as any)
		.from('user_active_routine')
		.select('routine_id')
		.eq('user_id', userId)
		.maybeSingle();
	const myActiveId = activeRow?.routine_id || null;

	// 3. 別人分享給我的（active）
	const { data: shares } = await (supabase as any)
		.from('routine_shares')
		.select('routine_id, permission, status, shared_by')
		.eq('user_id', userId)
		.eq('status', 'active');

	let sharedRoutines: any[] = [];
	if (shares && shares.length > 0) {
		const admin = getServiceClient(event);
		const ids = shares.map((s: any) => s.routine_id);
		const { data: rows } = await (admin as any)
			.from('routines')
			.select('*')
			.in('id', ids);
		const emailMap = await getUserEmails(admin, shares.map((s: any) => s.shared_by));
		const shareByRoutine = new Map(shares.map((s: any) => [s.routine_id, s]));
		sharedRoutines = (rows || []).map((r: any) => {
			const s = shareByRoutine.get(r.id);
			return {
				...r,
				_share: {
					permission: s.permission,
					status: s.status,
					shared_by_email: emailMap[s.shared_by] || ''
				}
			};
		});
	}

	const ownedTagged = (owned || []).map((r: any) => ({ ...r, _share: null }));
	const all = [...ownedTagged, ...sharedRoutines].map((r: any) => ({
		...r,
		_is_active_for_me: r.id === myActiveId
	}));

	return { success: true, data: all };
});
