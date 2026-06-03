import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server';
import { getAIService } from '~/server/services/aiService';
import { assertRoutineAccess } from '~/server/utils/routineAccess';

export default defineEventHandler(async (event) => {
	const user = await serverSupabaseUser(event);
	if (!user) throw createError({ statusCode: 401, statusMessage: '請先登入' });
	const userId = (user as any).id || (user as any).sub;

	await assertRoutineAccess(event, getRouterParam(event, 'id'), 'edit');

	const body = await readBody(event);
	const targetIssues: string[] = Array.isArray(body.targetIssues) ? body.targetIssues : [];
	const targetCategories: string[] = Array.isArray(body.targetCategories) ? body.targetCategories : [];

	const supabase = await serverSupabaseClient(event);

	// 取得使用者個人資料
	const { data: profile } = await (supabase as any)
		.from('profiles')
		.select('base_skin_type, issues, gender, birth_year')
		.eq('id', userId)
		.single();

	// 取得保養品櫃
	const { data: products } = await (supabase as any)
		.from('user_cabinet')
		.select('product_name, product_category, raw_ingredients')
		.eq('user_id', userId);

	if (!profile) throw createError({ statusCode: 404, statusMessage: '找不到個人資料' });

	const aiService = getAIService();
	const recommendations = await aiService.generateEfficacyRecommendations(
		profile,
		products || [],
		targetIssues,
		targetCategories
	);

	return { success: true, data: recommendations };
});
