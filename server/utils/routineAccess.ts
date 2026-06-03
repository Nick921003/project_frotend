import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import type { H3Event } from 'h3';

/**
 * 取得 service-key client（繞過 RLS）。
 * 僅可在 endpoint 內、完成 assertRoutineAccess 授權後使用。
 */
export function getServiceClient(event: H3Event): SupabaseClient {
	const config = useRuntimeConfig(event);
	if (!config.supabaseSecretKey) {
		throw createError({ statusCode: 500, statusMessage: 'Service key 未設定' });
	}
	// 強制指定 global.headers.Authorization 為 service key，防止繼承使用者的 token
	return createClient(config.public.supabaseUrl, config.supabaseSecretKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		},
		global: {
			headers: {
				Authorization: `Bearer ${config.supabaseSecretKey}`
			}
		}
	});
}

export interface RoutineAccess {
	userId: string;   // 當前登入者
	ownerId: string;  // 排程擁有者（寫入 routine_items 時 user_id 一律帶這個）
	role: 'owner' | 'member';
	permission: 'edit' | 'view'; // owner 恆 edit
}

/**
 * 授權守衛：判定當前使用者對 routineId 的存取權。
 * 內部用 service key 讀取（因 user client 受 RLS 限、讀不到他人排程）。
 * 失敗即 throw：401 未登入 / 404 排程不存在 / 403 無權限。
 */
export async function assertRoutineAccess(
	event: H3Event,
	routineId: string | undefined,
	required: 'view' | 'edit' | 'owner'
): Promise<RoutineAccess> {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;
	if (!userId) throw createError({ statusCode: 401, statusMessage: '無法識別用戶身份' });
	if (!routineId) throw createError({ statusCode: 400, statusMessage: '缺少 routine ID' });

	// 1. 先用原本使用者的 RLS client 嘗試查詢。
	// 如果當前使用者就是擁有者，走 RLS client 必定可以直接 select 到此排程！
	try {
		const userClient = await serverSupabaseClient(event);
		const { data: userRoutine } = await (userClient as any)
			.from('routines')
			.select('user_id')
			.eq('id', routineId)
			.maybeSingle();

		if (userRoutine) {
			const ownerId = userRoutine.user_id as string;
			if (userId === ownerId) {
				return { userId, ownerId, role: 'owner', permission: 'edit' };
			}
		}
	} catch (innerErr) {
		console.warn('[assertRoutineAccess] 使用 userClient 預先查詢失敗，將轉由 service_role 查詢:', innerErr);
	}

	const admin = getServiceClient(event);

	// 取得擁有者
	const { data: routine, error } = await (admin as any)
		.from('routines')
		.select('user_id')
		.eq('id', routineId)
		.single();
	if (error || !routine) {
		console.error('[assertRoutineAccess] 查詢排程擁有者失敗。routineId:', routineId, 'error:', error);
		throw createError({ statusCode: 404, statusMessage: '排程不存在' });
	}
	const ownerId = routine.user_id as string;

	// 擁有者：通過任何層級
	if (userId === ownerId) {
		return { userId, ownerId, role: 'owner', permission: 'edit' };
	}
	// 僅擁有者可執行（刪除、分享管理）
	if (required === 'owner') {
		throw createError({ statusCode: 403, statusMessage: '僅排程擁有者可執行此操作' });
	}
	// 協作者：查 active 分享列
	const { data: share } = await (admin as any)
		.from('routine_shares')
		.select('permission')
		.eq('routine_id', routineId)
		.eq('user_id', userId)
		.eq('status', 'active')
		.maybeSingle();
	if (!share) throw createError({ statusCode: 403, statusMessage: '無權限存取此排程' });

	const permission = share.permission as 'edit' | 'view';
	if (required === 'edit' && permission !== 'edit') {
		throw createError({ statusCode: 403, statusMessage: '僅可檢視，無編輯權限' });
	}
	return { userId, ownerId, role: 'member', permission };
}
