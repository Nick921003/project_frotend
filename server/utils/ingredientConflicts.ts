// 成分衝突偵測工具

type ConflictRule = {
	name: string;
	groupA: string[];	// 關鍵字清單（lowercase）
	groupB: string[];
	message: string;
};

const CONFLICT_RULES: ConflictRule[] = [
	{
		name: 'acid_retinol',
		groupA: ['glycolic acid', 'lactic acid', 'salicylic acid', 'mandelic acid', 'aha', 'bha', 'citric acid'],
		groupB: ['retinol', 'retinal', 'retinaldehyde', 'tretinoin', 'retinoic acid'],
		message: '酸類 + A醇同天使用可能過度刺激，建議分開早晚或隔天輪用'
	},
	{
		name: 'vitaminc_acid',
		groupA: ['ascorbic acid', 'l-ascorbic acid', 'vitamin c'],
		groupB: ['glycolic acid', 'lactic acid', 'salicylic acid', 'aha', 'bha'],
		message: 'Vitamin C + 酸類 pH 不相容，同時使用可能降低效果'
	}
];

export type ConflictWarning = {
	rule: string;
	message: string;
};

/**
 * 傳入某一天所有步驟的成分清單，回傳衝突警告。
 * allIngredients 是二維陣列：每個 item 的 string[] 成分。
 */
export function detectConflicts(allIngredients: string[][]): ConflictWarning[] {
	const flat = allIngredients.flat().map(s => s.toLowerCase());
	const warnings: ConflictWarning[] = [];

	for (const rule of CONFLICT_RULES) {
		const hasA = rule.groupA.some(k => flat.some(i => i.includes(k)));
		const hasB = rule.groupB.some(k => flat.some(i => i.includes(k)));
		if (hasA && hasB) {
			warnings.push({ rule: rule.name, message: rule.message });
		}
	}

	return warnings;
}
