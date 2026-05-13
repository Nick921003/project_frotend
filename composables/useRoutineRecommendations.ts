import { ref } from 'vue';
import type { Ref } from 'vue';
import type { WeeklyRoutine, CabinetProductItem } from '~/types/routine';

export interface EfficacyRecommendation {
	issue: string;
	category: string;
	suggestedIngredients: string[];
	reason: string;
}

// 使用順序建議（靜態，不依賴 API）
export const USAGE_ORDER_TIPS = [
	{ category: '洗臉產品', timing: '早晚', tip: '清潔第一步，溫和帶走污垢', step: 1 },
	{ category: '化妝水', timing: '早晚', tip: '補水收斂，幫助後續成分吸收', step: 2 },
	{ category: '精華液', timing: '早晚', tip: '集中護理，針對肌膚問題', step: 3 },
	{ category: '眼霜', timing: '早晚', tip: '在乳液前使用，輕拍至吸收', step: 4 },
	{ category: '乳液', timing: '早晚', tip: '鎖水保濕，封住前一步驟成分', step: 5 },
	{ category: '面膜', timing: '晚間', tip: '建議 1–3 次/週，可替換精華步驟', step: 6 },
	{ category: '防曬', timing: '早晨', tip: '日間最後一步，需均勻補擦', step: 7 },
];

export function useRoutineRecommendations(
	routine: Ref<WeeklyRoutine | null>,
	availableProducts: Ref<CabinetProductItem[]>,
	routineId: string
) {
	const efficacyRecs = ref<EfficacyRecommendation[]>([]);
	const recsLoading = ref(false);

	const loadEfficacyRecs = async (targetIssues: string[]) => {
		if (!routineId) return;
		recsLoading.value = true;
		try {
			const res = await $fetch<{ success: boolean; data: EfficacyRecommendation[] }>(
				`/api/routines/${routineId}/efficacy-recs`,
				{ method: 'POST', body: { targetIssues } }
			);
			if (res.success) efficacyRecs.value = res.data;
		} catch (e) {
			console.warn('[useRoutineRecommendations] 功效推薦載入失敗');
		} finally {
			recsLoading.value = false;
		}
	};

	return {
		efficacyRecs,
		recsLoading,
		loadEfficacyRecs,
		usageOrderTips: USAGE_ORDER_TIPS,
	};
}

