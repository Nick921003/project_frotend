import { serverSupabaseServiceRole } from '#supabase/server';

export default defineEventHandler(async (event) => {
	try {
		const config = useRuntimeConfig(event);
		const secretKeyLen = config.supabaseSecretKey ? config.supabaseSecretKey.length : 0;
		const secretKeyPrefix = config.supabaseSecretKey ? config.supabaseSecretKey.substring(0, 10) : 'none';
		
		const admin = await serverSupabaseServiceRole(event);
		const q = String(getQuery(event).q || 'test').trim();
		const { data, error } = await (admin as any).rpc('search_user_emails', { prefix: q });
		
		return {
			success: !error,
			query: q,
			secretKeyLength: secretKeyLen,
			secretKeyPrefix: secretKeyPrefix,
			rpcResult: data || [],
			rpcError: error ? error.message : null
		};
	} catch (e: any) {
		return {
			success: false,
			error: e.message
		};
	}
});
