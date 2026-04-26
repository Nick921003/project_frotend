// server/api/analyze.post.ts
import { createClient } from '@supabase/supabase-js';
import { getAIService } from '~/server/services/aiService';

// 定義有效的膚質類型
const VALID_SKIN_TYPES = ['oily', 'dry', 'combination', 'sensitive', 'normal'];

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const supabase = createClient(
    config.public.supabaseUrl,
    config.supabaseSecretKey
  );
  const aiService = getAIService();

  try {
    const body = await readBody(event);
    const { imageBase64, imageBase64Array, skinType } = body;

    // 支援單張（imageBase64）或多張（imageBase64Array）
    const rawImages: string[] = imageBase64Array
      ? (Array.isArray(imageBase64Array) ? imageBase64Array : [imageBase64Array])
      : imageBase64
        ? [imageBase64]
        : [];

    if (rawImages.length === 0) {
      throw createError({ statusCode: 400, statusMessage: '缺少必要參數：imageBase64 或 imageBase64Array' });
    }

    // 驗證膚質類型（非必須，但若提供則必須有效）
    if (skinType && !VALID_SKIN_TYPES.includes(skinType)) {
      throw createError({
        statusCode: 400,
        statusMessage: `無效的膚質類型。有效值：${VALID_SKIN_TYPES.join(', ')}`
      });
    }

    // 1. 清洗 Base64 (去除可能來自前端的 data:image/jpeg;base64, 前綴)
    const base64DataArray = rawImages.map(img => img.replace(/^data:image\/\w+;base64,/, ""));

    // 2. 使用 AIService 進行圖像分析（支援多張）
    let inciArray: string[];
    let detectedProductName: string | null = null;
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

    // 5. 查詢 Supabase official_ingredients 進行比對
    const { data: matchedIngredients, error: dbError } = await supabase
      .from('official_ingredients')
      .select('inci_name, limit_standard, warning_text, skin_type_risks')
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

    // 計算安全/未知成分（使用 Set 提升性能）
    const safeOrUnknownIngredients = inciArray.filter(inci => !flaggedInciNames.has(inci));

    // 7a. RAG 檢索：query embedding → pgvector top-K 文獻
    let ragContext: any[] = [];
    try {
      const queryText = `${inciArray.slice(0, 5).join(', ')} skincare effects safety ${skinType || ''}`;
      const queryEmbedding = await aiService.embedQuery(queryText);
      const { data: matches, error: rpcError } = await supabase.rpc('match_medical_documents', {
        query_embedding: queryEmbedding,
        match_count: 3,
        ingredient_filter: null,
      });
      if (rpcError) throw new Error(rpcError.message);
      ragContext = matches || [];
      console.log(`[Analyze API] RAG 命中 ${ragContext.length} 篇文獻`);
    } catch (ragError: any) {
      console.warn('[Analyze API] RAG 檢索失敗，降級為純 LLM 評語:', ragError.message);
      ragContext = [];
    }

    // 7b. 生成評語（有 RAG context 走文獻佐證版，否則 fallback 純 LLM）
    let aiSummary: string;
    try {
      if (ragContext.length > 0) {
        console.log('[Analyze API] 使用 AIService 生成 RAG 產品評語');
        aiSummary = await aiService.generateProductSummaryWithRAG(
          inciArray,
          skinType || 'general',
          ragContext
        );
      } else {
        console.log('[Analyze API] 使用 AIService 生成產品評語（無 RAG）');
        aiSummary = await aiService.generateProductSummary(inciArray, skinType || 'general');
      }
    } catch (summaryError: any) {
      console.error('[Analyze API] AI 評語生成失敗:', summaryError.message);
      aiSummary = '產品評語生成失敗，但成分分析已完成。';
    }

    // 8. 最終資料重組與回傳
    return {
      status: 'success',
      message: '雙引擎分析完成',
      data: {
        rawAiOutput: inciArray,
        detectedProductName,
        analysis: {
          regulatoryAlerts,  // DB 處理：法規紅燈（強制警語/禁用）
          limitAlerts,       // DB 處理：限量成分黃燈（濃度未知）
          skinTypeAlerts,    // DB 處理：膚質黃燈
          safeList: safeOrUnknownIngredients // DB 未匹配到的成分
        },
        overallSummary: aiSummary,
        references: ragContext.map((d: any) => ({
          title: d.title,
          journal: d.journal,
          year: d.publication_year,
          doi: d.doi,
          ingredient_query: d.ingredient_query,
          similarity: d.similarity,
        }))
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