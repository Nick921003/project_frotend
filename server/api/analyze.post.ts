// server/api/analyze.post.ts
import { createClient } from '@supabase/supabase-js';
import { serverSupabaseUser } from '#supabase/server';
import { getAIService } from '~/server/services/aiService';

const GUEST_DAILY_LIMIT = 3;

// 定義有效的膚質類型
const VALID_SKIN_TYPES = ['oily', 'dry', 'combination', 'combination_oily', 'combination_dry', 'sensitive', 'normal'];

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const supabase = createClient(
    config.public.supabaseUrl,
    config.supabaseSecretKey
  );
  const aiService = getAIService();

  try {
		const body = await readBody(event);
		const { imageBase64, imageBase64Array, skinType, productName, ingredientsText } = body;

		// 支援單張（imageBase64）或多張（imageBase64Array）
		const rawImages: string[] = imageBase64Array
			? (Array.isArray(imageBase64Array) ? imageBase64Array : [imageBase64Array])
			: imageBase64
				? [imageBase64]
				: [];

		if (rawImages.length === 0 && !ingredientsText) {
			throw createError({ statusCode: 400, statusMessage: '缺少必要參數：請提供成分照片，或提供成分文字' });
		}

    // 訪客限速：每 IP 每天 GUEST_DAILY_LIMIT 次
    const user = await serverSupabaseUser(event).catch(() => null);
    if (!user) {
      const ip =
        getRequestHeader(event, 'x-forwarded-for')?.split(',')[0].trim() ||
        event.node.req.socket?.remoteAddress ||
        'unknown';
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const { data: limitRow } = await supabase
        .from('guest_rate_limits')
        .select('count')
        .eq('ip', ip)
        .eq('date', today)
        .single();

      const currentCount = (limitRow as any)?.count ?? 0;

      if (currentCount >= GUEST_DAILY_LIMIT) {
        throw createError({
          statusCode: 429,
          statusMessage: `訪客每日分析上限為 ${GUEST_DAILY_LIMIT} 次，請登入後繼續使用`
        });
      }

      await supabase
        .from('guest_rate_limits')
        .upsert({ ip, date: today, count: currentCount + 1 }, { onConflict: 'ip,date' });
    }

    // 驗證膚質類型（非必須，但若提供則必須有效）
    if (skinType && !VALID_SKIN_TYPES.includes(skinType)) {
      throw createError({
        statusCode: 400,
        statusMessage: `無效的膚質類型。有效值：${VALID_SKIN_TYPES.join(', ')}`
      });
    }

		let inciArray: string[];
		let detectedProductName: string | null = null;

		if (ingredientsText) {
			// 若有傳入 ingredientsText，則直接使用文字提取
			try {
				console.log(`[Analyze API] 使用 AIService 從文字提取成分`);
				const extracted = await aiService.extractIngredientsFromText(ingredientsText, productName);
				inciArray = extracted.ingredients;
				detectedProductName = extracted.productName || productName || null;
			} catch (extractError: any) {
				throw createError({
					statusCode: 500,
					statusMessage: 'AI 文字分析失敗: ' + extractError.message
				});
			}
		} else {
			// 1. 清洗 Base64 (去除可能來自前端的 data:image/jpeg;base64, 前綴)
			const base64DataArray = rawImages.map(img => img.replace(/^data:image\/\w+;base64,/, ""));

			// 2. 使用 AIService 進行圖像分析（支援多張）
			try {
				console.log(`[Analyze API] 使用 AIService 提取圖像成分，共 ${base64DataArray.length} 張`);
				const extracted = await aiService.extractIngredientsFromImage(base64DataArray);
				inciArray = extracted.ingredients;
				detectedProductName = extracted.productName;
			} catch (extractError: any) {
				throw createError({
					statusCode: 500,
					statusMessage: 'AI 圖像分析失敗: ' + extractError.message
				});
			}
		}

    // 5. 查詢 Supabase official_ingredients 進行比對（含功效欄位）
    const { data: matchedIngredients, error: dbError } = await supabase
      .from('official_ingredients')
      .select('inci_name, limit_standard, warning_text, skin_type_risks, efficacy_tags, function_summary')
      .in('inci_name', inciArray);

    if (dbError) {
      throw createError({ statusCode: 500, statusMessage: '資料庫比對失敗' });
    }

    // 5b. 查詢 TFDA 官方法規資料庫（cosmetic_regulations）
    const inciLower = inciArray.map(i => i.toLowerCase());
    const { data: tfdaMatches } = await supabase
      .from('cosmetic_regulations')
      .select('ingredient_name, inci_name, regulation_type, limit_standard, restriction_rules, warning_labels, notes, product_scope')
      .or(`inci_name.in.(${inciArray.map(i => `"${i}"`).join(',')}),ingredient_name.in.(${inciArray.map(i => `"${i}"`).join(',')})`);

    // 6. 雙重過濾分類引擎 -- 法規警告 + 限量成分 + 膚質個性化警告
    const regulatoryAlerts: any[] = [];
    const limitAlerts: any[] = [];
    const skinTypeAlerts: any[] = [];
    const flaggedInciNames = new Set<string>();

    if (matchedIngredients && matchedIngredients.length > 0) {
      matchedIngredients.forEach((dbIng: any) => {
        // 檢查 A1: 強制警語/禁用 → 紅燈
        if (dbIng.warning_text) {
          regulatoryAlerts.push({
            inci_name: dbIng.inci_name,
            warning: dbIng.warning_text,
            limit: dbIng.limit_standard,
            severity: 'critical'
          });
          flaggedInciNames.add(dbIng.inci_name);
        } else if (dbIng.limit_standard) {
          // 檢查 A2: 有限量規定但濃度未知 → 黃燈
          limitAlerts.push({
            inci_name: dbIng.inci_name,
            limit: dbIng.limit_standard,
            severity: 'warning'
          });
          flaggedInciNames.add(dbIng.inci_name);
        }

        // 檢查 B: 膚質個性化警告
        if (skinType && dbIng.skin_type_risks && typeof dbIng.skin_type_risks === 'object' && !Array.isArray(dbIng.skin_type_risks)) {
          const riskForSkinType = dbIng.skin_type_risks[skinType];
          if (riskForSkinType) {
            skinTypeAlerts.push({
              inci_name: dbIng.inci_name,
              risk_description: riskForSkinType,
              severity: 'warning'
            });
            flaggedInciNames.add(dbIng.inci_name);
          }
        }
      });
    }

    // 檢查 TFDA 法規資料庫
    if (tfdaMatches && tfdaMatches.length > 0) {
      tfdaMatches.forEach((reg: any) => {
        const name = reg.inci_name || reg.ingredient_name;
        if (reg.regulation_type === 'banned') {
          regulatoryAlerts.push({
            inci_name: name,
            warning: `台灣 TFDA 禁用成分${reg.notes ? '：' + reg.notes : ''}`,
            limit: null,
            severity: 'critical',
            source: 'TFDA'
          });
        } else {
          const hasWarningText = !!(reg.warning_labels || reg.restriction_rules);
          if (hasWarningText) {
            regulatoryAlerts.push({
              inci_name: name,
              warning: reg.warning_labels || reg.restriction_rules,
              limit: reg.limit_standard || null,
              severity: 'critical',
              source: 'TFDA',
              regulation_type: reg.regulation_type,
              product_scope: reg.product_scope
            });
          } else {
            limitAlerts.push({
              inci_name: name,
              limit: reg.limit_standard || null,
              severity: 'warning',
              source: 'TFDA',
              regulation_type: reg.regulation_type,
              product_scope: reg.product_scope
            });
          }
        }
        flaggedInciNames.add(name);
      });
    }

    // 計算安全/未知成分，同時附上 DB 中的功效說明
    const dbMap = new Map((matchedIngredients as any[] ?? []).map((i: any) => [i.inci_name, i]));
    const safeOrUnknownIngredients = inciArray
      .filter(inci => !flaggedInciNames.has(inci))
      .map(inci => {
        const dbRow = dbMap.get(inci) as any;
        return {
          inci_name: inci,
          efficacy_tags: dbRow?.efficacy_tags ?? [],
          function_summary: dbRow?.function_summary ?? null
        };
      });

    // 7. 從 DB 資料計算 efficacySummary.primaryTags
    const tagCount: Record<string, number> = {};
    if (matchedIngredients) {
      for (const ing of matchedIngredients as any[]) {
        const tags: string[] = ing.efficacy_tags || [];
        for (const tag of tags) {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        }
      }
    }
    const primaryTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    // 功效標籤對應膚質適合度
    const TAG_SUITABLE: Record<string, { for: string[]; notFor: string[] }> = {
      moisturizing:  { for: ['乾性肌', '混合肌'], notFor: [] },
      exfoliating:   { for: ['油性肌', '混合肌'], notFor: ['敏感肌'] },
      antioxidant:   { for: ['所有膚質'], notFor: [] },
      soothing:      { for: ['敏感肌', '乾性肌'], notFor: [] },
      brightening:   { for: ['混合肌', '油性肌'], notFor: [] },
      sunscreen:     { for: ['所有膚質'], notFor: [] },
      anti_acne:     { for: ['油性肌', '混合肌'], notFor: ['乾性肌'] },
      anti_aging:    { for: ['乾性肌', '混合肌'], notFor: [] },
      emollient:     { for: ['乾性肌'], notFor: ['油性肌'] },
      preservative:  { for: [], notFor: [] },
    };
    const suitableSet = new Set<string>();
    const notIdealSet = new Set<string>();
    for (const tag of primaryTags) {
      const map = TAG_SUITABLE[tag];
      if (map) {
        map.for.forEach(s => suitableSet.add(s));
        map.notFor.forEach(s => notIdealSet.add(s));
      }
    }

    // 8. 使用 AIService 生成配方綜合評估（含 verdict）
    let aiOverview = '產品評語生成失敗，但成分分析已完成。';
    let aiVerdict = '';
    try {
      console.log('[Analyze API] 使用 AIService 生成產品評語');
      const summaryResult = await aiService.generateProductSummary(inciArray, skinType || 'general', matchedIngredients as any[] ?? []);
      aiOverview = summaryResult.overview;
      aiVerdict = summaryResult.verdict;
    } catch (summaryError: any) {
      console.error('[Analyze API] AI 評語生成失敗:', summaryError.message);
    }

    const efficacySummary = {
      primaryTags,
      verdict: aiVerdict,
      suitableFor: Array.from(suitableSet),
      notIdealFor: Array.from(notIdealSet)
    };

		// 9. 最終資料重組與回傳
		return {
			status: 'success',
			message: '雙引擎分析完成',
			data: {
				rawAiOutput: inciArray,
				rawIngredients: JSON.stringify(inciArray),
				detectedProductName,
				analysis: {
					regulatoryAlerts,
					limitAlerts,
					skinTypeAlerts,
					safeList: safeOrUnknownIngredients,
					efficacySummary
				},
				overallSummary: aiOverview
			}
		};

  } catch (error: any) {
    console.error('[Analyze API Error]:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'AI 辨識或解析失敗',
    });
  }
});