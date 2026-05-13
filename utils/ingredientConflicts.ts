/**
 * 成分衝突偵測工具
 * 定義高頻衝突對，供排程拖拉時即時提示
 */

export interface ConflictWarning {
	ingredientA: string;
	ingredientB: string;
	reason: string;
	products: [string, string]; // [產品A名稱, 產品B名稱]
}

interface ConflictRule {
	/** 成分 A 的關鍵字（小寫，部分比對） */
	keywordsA: string[];
	/** 成分 B 的關鍵字（小寫，部分比對） */
	keywordsB: string[];
	/** 顯示名稱 A */
	labelA: string;
	/** 顯示名稱 B */
	labelB: string;
	/** 衝突原因說明 */
	reason: string;
}

const CONFLICT_RULES: ConflictRule[] = [
	{
		keywordsA: ['retinol', 'retinoic acid', 'tretinoin', 'retinyl'],
		keywordsB: ['aha', 'glycolic acid', 'lactic acid', 'mandelic acid', 'bha', 'salicylic acid', 'beta hydroxy'],
		labelA: 'Retinol / A 醇',
		labelB: 'AHA / BHA 酸類',
		reason: '同時使用可能過度刺激肌膚，建議早晚分開或分天使用',
	},
	{
		keywordsA: ['ascorbic acid', 'vitamin c', 'l-ascorbic acid', 'ascorbyl'],
		keywordsB: ['niacinamide', 'nicotinamide', 'vitamin b3'],
		labelA: 'Vitamin C',
		labelB: 'Niacinamide',
		reason: '高濃度同時使用可能降低各自效果或產生泛黃；建議間隔 30 分鐘以上',
	},
	{
		keywordsA: ['benzoyl peroxide', 'benzyl peroxide'],
		keywordsB: ['retinol', 'retinoic acid', 'tretinoin', 'retinyl'],
		labelA: 'Benzoyl Peroxide',
		labelB: 'Retinol / A 醇',
		reason: '過氧化苯甲醯會氧化並分解 Retinol，使兩者效果均大幅降低',
	},
	{
		keywordsA: ['retinol', 'retinoic acid', 'tretinoin', 'retinyl'],
		keywordsB: ['vitamin c', 'ascorbic acid', 'l-ascorbic acid'],
		labelA: 'Retinol / A 醇',
		labelB: 'Vitamin C',
		reason: '兩者皆為強效活性成分，同時使用刺激性高；建議早晚分開使用',
	},
];

/**
 * 判斷某組成分列表是否含有指定關鍵字之一
 */
function hasKeyword(ingredients: string[], keywords: string[]): boolean {
	const lowerIngredients = ingredients.map(i => i.toLowerCase());
	return keywords.some(kw =>
		lowerIngredients.some(ing => ing.includes(kw.toLowerCase()))
	);
}

/**
 * 檢查同一時段的產品列表是否存在成分衝突
 * @param items 同時段的排程項目（含 ingredients）
 * @returns 衝突警示陣列
 */
export function checkConflicts(
	items: Array<{ product_name: string; ingredients?: string[] }>
): ConflictWarning[] {
	const warnings: ConflictWarning[] = [];

	for (const rule of CONFLICT_RULES) {
		// 找出含有關鍵字 A 的產品
		const productsWithA = items.filter(
			item => item.ingredients && hasKeyword(item.ingredients, rule.keywordsA)
		);
		// 找出含有關鍵字 B 的產品
		const productsWithB = items.filter(
			item => item.ingredients && hasKeyword(item.ingredients, rule.keywordsB)
		);

		if (productsWithA.length > 0 && productsWithB.length > 0) {
			// 避免重複警示（A/B 互換的同一衝突）
			const key = [rule.labelA, rule.labelB].sort().join('|');
			const alreadyReported = warnings.some(
				w => [w.ingredientA, w.ingredientB].sort().join('|') === key
			);
			if (alreadyReported) continue;

			warnings.push({
				ingredientA: rule.labelA,
				ingredientB: rule.labelB,
				reason: rule.reason,
				products: [productsWithA[0]!.product_name, productsWithB[0]!.product_name],
			});
		}
	}

	return warnings;
}
