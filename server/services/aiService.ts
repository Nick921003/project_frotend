/**
 * server/services/aiService.ts
 * 
 * 集中管理所有 AI 相關的服務邏輯
 * - Gemini API 調用
 * - Prompt 生成與管理
 * - 結果解析
 * 
 * 目的：將 AI 邏輯獨立出來，便於版本控制、測試和升級
 */

import type { UserProfileData, CabinetProduct, RoutinePreferences, GeminiRoutineResponse } from '~/types/routine';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Gemini 配置
 */
interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const defaultConfig: GeminiConfig = {
  apiKey: GEMINI_API_KEY || '',
  model: GEMINI_MODEL,
  temperature: 0.7,
  maxTokens: 2000
};

/**
 * AI 服務類
 */
export class AIService {
  private config: GeminiConfig;

  constructor(config?: Partial<GeminiConfig>) {
    this.config = { ...defaultConfig, ...config };
    
    if (!this.config.apiKey) {
      throw new Error('GEMINI_API_KEY 環境變數未設置');
    }
  }

  /**
   * 生成排程的詳細 Prompt（包含複雜度、優先順序、產品分析等）
   * 這是比基礎 generateRoutinePrompt 更詳細的版本
   */
  generateDetailedRoutinePrompt(
    profile: UserProfileData,
    products: CabinetProduct[],
    preferences: RoutinePreferences,
    analysisResults?: Record<string, any>
  ): string {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let profileSummary = `
=== USER PROFILE ===
- Skin Type: ${profile.base_skin_type}
- Gender: ${profile.gender || 'Not specified'}
- Birth Year: ${profile.birth_year || 'Not specified'}
- Age: ${profile.birth_year ? new Date().getFullYear() - profile.birth_year : 'Unknown'}
- Skin Issues/Concerns: ${profile.issues || 'None specified'}
`;

    let productSummary = `
=== EXISTING PRODUCTS ===
Total Products: ${products.length}

`;

    if (products.length > 0) {
      productSummary += products.map((p, i) => {
        const ingredients = this.tryParseIngredients(p.raw_ingredients);
        return `
${i + 1}. ${p.product_name}
   Category: ${p.product_category}
   Ingredients: ${ingredients.join(', ') || 'Unknown'}
   Analysis: ${p.analysis_result ? JSON.stringify(p.analysis_result) : 'Not analyzed'}
`;
      }).join('');
    } else {
      productSummary += 'No products in cabinet.';
    }

    // ==================
    // 基於 preferences 生成配置指令
    // ==================
    let preferenceInstructions = `
=== USER PREFERENCES (THIS SESSION) ===
- Routine Complexity: ${preferences.complexity}
  ${preferences.complexity === 'minimal' ? '  (Focus on essential steps: 3 products per day max)' : preferences.complexity === 'standard' ? '  (Balance between efficacy and simplicity: 5 products per day)' : '  (Comprehensive routine with all beneficial steps: 7+ products per day)'}
- Target Issues to Address: ${preferences.targetIssues.length > 0 ? preferences.targetIssues.join(', ') : 'General skincare'}
- Priority: ${preferences.priority}
  ${preferences.priority === 'speed' ? '  (Minimize routine time, fewer steps)' : preferences.priority === 'affordability' ? '  (Use existing products efficiently, minimal purchases)' : '  (Maximum effectiveness, use best products for results)'}
- Allow Recommendations: ${preferences.allowRecommendations ? 'YES' : 'NO'}
  ${preferences.allowRecommendations ? `(Recommend missing products when important ingredients are lacking. Suggest if ${preferences.recommendThreshold}+ issues cannot be addressed)` : '(Only use existing products, no recommendations)'}
`;

    // 複雜度相關指令
    let complexityInstruction = '';
    if (preferences.complexity === 'minimal') {
      complexityInstruction = `
COMPLEXITY INSTRUCTION: Create a MINIMAL routine.
- Maximum 3 products per day (morning) and 3 products per day (evening)
- Focus on essential steps: Cleanser → Moisturizer (+ optional targeted treatment)
- Skip secondary steps like toners, essences, masks unless addressing specific issues`;
    } else if (preferences.complexity === 'standard') {
      complexityInstruction = `
COMPLEXITY INSTRUCTION: Create a STANDARD routine.
- 4-5 products per day for morning and evening routines
- Include: Cleanser → Toner/Essence → Serum/Treatment → Moisturizer → Sunscreen (AM only)
- Balance between effectiveness and simplicity`;
    } else {
      complexityInstruction = `
COMPLEXITY INSTRUCTION: Create a COMPREHENSIVE routine.
- 6-8+ products per day (morning) and 7-10 products per day (evening)
- Include all beneficial steps: Cleanser → Toner → Essence → Multiple Serums → Sheet Masks → Moisturizer → Eye Cream → Sunscreen (AM) → Sleeping Mask (PM)
- Maximize skin benefits with layered active ingredients`;
    }

    // 優先順序相關指令
    let priorityInstruction = '';
    if (preferences.priority === 'speed') {
      priorityInstruction = `
PRIORITY INSTRUCTION: MINIMIZE TIME
- Reduce multi-step routines, prefer combo products (e.g., toner+essence, moisturizer+SPF)
- Use only proven effective products from their cabinet
- Avoid lengthy application steps`;
    } else if (preferences.priority === 'affordability') {
      priorityInstruction = `
PRIORITY INSTRUCTION: MAXIMIZE EXISTING PRODUCTS
- Use all products from their cabinet as much as possible
- Only recommend products if critical ingredients are completely missing
- Prefer budget-friendly alternatives or ingredient combinations`;
    } else {
      priorityInstruction = `
PRIORITY INSTRUCTION: MAXIMUM EFFECTIVENESS
- Prioritize products with proven active ingredients (retinol, niacinamide, hyaluronic acid, peptides, etc.)
- Recommend premium products if gaps exist in efficacy
- Combine complementary ingredients for synergistic effects`;
    }

    const prompt = `
You are a professional skincare formulation expert and dermatologist. Your task is to create a personalized weekly skincare routine for a user.

${profileSummary}

${productSummary}

${preferenceInstructions}

=== INSTRUCTIONS ===
Based on the user's skin profile, existing products, and THIS SESSION's preferences, create a detailed weekly skincare routine (Monday-Sunday, Morning & Evening).

${complexityInstruction}

${priorityInstruction}

IMPORTANT RULES:
1. Each day has a "morning" and "evening" routine
2. For each timeslot, list the products in the order they should be applied (0-based sequence_order)
3. If user's skin issues CANNOT be adequately addressed with existing products:
   ${preferences.allowRecommendations ? '   - Generate ingredient-focused recommendations (e.g., "Niacinamide Serum", "Salicylic Acid Toner") instead of full product names' : '   - Only use existing products, do NOT create recommendations'}
4. Mark recommendation items with is_recommendation: true and explain their benefits in recommendation_reason
5. Each item must include the product name, category, and detected/relevant ingredients
6. Target Issues (${preferences.targetIssues.join(', ') || 'general'}) should be prioritized in the routine${preferences.allowRecommendations ? '' : ' using only existing products'}

RESPONSE FORMAT:
You MUST respond with ONLY valid JSON (no markdown, no code blocks), with this exact structure:

{
  "name": "My Weekly Skincare Routine",
  "description": "A personalized routine based on your profile",
  "items": [
    {
      "day_of_week": 0,
      "time_of_day": "morning",
      "sequence_order": 0,
      "product_name": "Product Name",
      "product_category": "Cleanser|Toner|Essence|Serum|Sheet Mask|Cream|Sunscreen|etc",
      "ingredients": ["ingredient1", "ingredient2"],
      "is_recommendation": false,
      "recommendation_reason": null,
      "notes": "Optional usage notes"
    },
    ...
  ]
}

EXAMPLES OF INGREDIENT RECOMMENDATIONS (if allowRecommendations=true):
- If user has acne but lacks BHAs: {"product_name": "Salicylic Acid Essence", "is_recommendation": true, "recommendation_reason": "2-3次/週 使用，深層清潔毛孔、減少黑頭，改善粉刺"}
- If user has aging concerns but no retinol: {"product_name": "Retinol Serum", "is_recommendation": true, "recommendation_reason": "晚間使用，促進膠原蛋白生成、減少細紋，改善肌膚彈性"}
- If user lacks hydration boosters: {"product_name": "Hyaluronic Acid Serum", "is_recommendation": true, "recommendation_reason": "強化肌膚保水力，特別適合乾性膚質，改善繃緊感"}

OUTPUT LANGUAGE:
- Use Traditional Chinese (繁體中文) for all product_name and recommendation_reason fields
- Make recommendations sound natural and friendly, not mechanical
- Provide specific usage frequency and benefits, not just generic features
- Drop excessive technical jargon, keep it relatable

Now, create the weekly routine as JSON only:
`;

    return prompt;
  }

  /**
   * 嘗試解析產品成分（輔助方法）
   */
  private tryParseIngredients(rawIngredients: string | null): string[] {
    if (!rawIngredients) return [];

    try {
      const parsed = JSON.parse(rawIngredients);
      if (Array.isArray(parsed)) {
        return parsed.map(i => typeof i === 'string' ? i : String(i)).slice(0, 10);
      }
    } catch {
      // 不是有效的 JSON，嘗試其他格式
    }

    // 嘗試逗號分隔
    if (typeof rawIngredients === 'string' && rawIngredients.includes(',')) {
      return rawIngredients.split(',').map(s => s.trim()).filter(s => s.length > 0).slice(0, 10);
    }

    return [rawIngredients];
  }

  /**
   * 調用 Gemini API 生成排程（詳細版）
   */
  async generateDetailedRoutine(
    profile: UserProfileData,
    products: CabinetProduct[],
    preferences: RoutinePreferences
  ): Promise<GeminiRoutineResponse> {
    try {
      // 生成詳細 prompt
      const prompt = this.generateDetailedRoutinePrompt(profile, products, preferences);

      console.log('[AIService] 開始調用 Gemini API 生成詳細排程');
      console.log('[AIService] Model:', this.config.model);

      // 調用 Gemini API
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.config.apiKey);
      const model = genAI.getGenerativeModel({
        model: this.config.model,
        generationConfig: {
          temperature: 0.3
        }
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      console.log('[AIService] 獲得回應，開始解析...');

      // 解析 JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('無法從回應中提取 JSON');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]) as GeminiRoutineResponse;

      // 驗證響應結構
      if (!parsedResponse.items || !Array.isArray(parsedResponse.items)) {
        throw new Error('回應中缺少 items 陣列');
      }

      console.log('[AIService] 解析成功，生成項目數:', parsedResponse.items.length);
      
      return parsedResponse;
    } catch (error: any) {
      console.error('[AIService] 錯誤:', error.message);
      throw new Error(`AI 生成失敗: ${error.message}`);
    }
  }

  /**
   * 進行圖像 OCR 成分辨識（提取產品名稱 + INCI 陣列）
   * 支援單張或多張照片（同一產品不同角度）
   */
  async extractIngredientsFromImage(
    imageBase64: string | string[]
  ): Promise<{ productName: string | null; ingredients: string[] }> {
    const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64];
    try {
      const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.config.apiKey);

      const model = genAI.getGenerativeModel({
        model: this.config.model,
        systemInstruction: `你是一位國際頂尖的化妝品配方師與影像辨識專家。
你的任務是：辨識使用者上傳的保養品照片，提取產品名稱與所有成分。
嚴格規則：
1. productName：從標籤或外包裝找出最完整的產品名稱（可含品牌名）。命名規則如下：
   - 若標籤上有完整中文名稱（例如「理膚寶水清爽保濕乳液」）：直接使用中文，不附加英文。
   - 若品牌名是英文縮寫或英文商標（如 DRWU、SK-II、CeraVe、La Roche-Posay、Tatcha 等），而無對應中文品牌名：以「英文品牌名 + 中文品類描述」格式命名，例如「DRWU精華液」、「CeraVe保濕乳霜」、「La Roche-Posay防曬乳」。
   - 若完全無法辨識產品名稱：回傳 null。
2. ingredients：將所有語言（包含中文、日文、韓文）、俗名或錯別字，強制精確翻譯為標準的「INCI Name (國際化妝品原料命名)」，全英文。
3. 忽略標點符號、濃度百分比、用途說明等非成分資訊。
4. 若有多張照片，請合併所有照片的成分，去除重複後回傳。
5. 絕對不可包含任何解釋、問候語、Markdown 標記 (如 \`\`\`json) 或其他廢話。`,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              productName: { type: SchemaType.STRING, nullable: true },
              ingredients: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
            },
            required: ['ingredients'],
          },
        },
      });

      const imageParts = images.map(b64 => ({
        inlineData: {
          data: b64,
          mimeType: "image/jpeg" as const,
        },
      }));

      const prompt = images.length > 1
        ? "這些照片是同一個產品的不同角度（正面標籤、成分表、宣傳說明等）。請辨識產品名稱，並萃取所有照片中出現的成分，合併去重後，依照指示回傳 JSON。"
        : "請辨識產品名稱，並萃取圖片中的成分，依照指示回傳 JSON。";

      const result = await model.generateContent([...imageParts, prompt]);

      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);
      const ingredients: string[] = parsed.ingredients || [];
      const productName: string | null = parsed.productName || null;

      if (!Array.isArray(ingredients) || ingredients.length === 0) {
        throw new Error("AI 無法從圖片中辨識出任何有效成分");
      }

      console.log(`[AIService] 從 ${images.length} 張圖像提取成分，共 ${ingredients.length} 個，產品名稱：${productName ?? '未辨識'}`);
      return { productName, ingredients };
    } catch (error: any) {
      console.error('[AIService] 圖像分析錯誤:', error.message);
      throw new Error(`圖像成分提取失敗: ${error.message}`);
    }
  }

  /**
   * 生成成分總結評語（用於 analyze.post.ts 的配方評估）
   */
  async generateProductSummary(
    ingredients: string[],
    skinType: string
  ): Promise<string> {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.config.apiKey);
      const model = genAI.getGenerativeModel({
        model: this.config.model,
        generationConfig: { temperature: 0.3 }
      });

      const skinTypeLabel = skinType || '一般膚質 (未提供)';
      
      const summaryPrompt = `
      你是一位專業的化妝品配方師。請根據以下的保養品 INCI 成分表，以及使用者的膚質，給出一段專業、白話且具有價值的整體評價。
      
      成分表：${ingredients.join(', ')}
      使用者膚質：${skinTypeLabel}
      
      嚴格輸出規則：
      1. 點出這支產品的「核心功效」（如：偏向保濕、抗老、酸類煥膚等）。
      2. 針對該使用者的膚質，給出「是否推薦」以及「使用建議或潛在風險」。
      3. 字數限制在 100 字以內，語氣要像專業且溫柔的皮膚科醫生。
      4. 純文字輸出，不可使用任何 Markdown 標記 (如 ** 或 #)。
    `;

      const result = await model.generateContent(summaryPrompt);
      const summary = result.response.text();

      console.log('[AIService] 生成產品總結');
      return summary;
    } catch (error: any) {
      console.error('[AIService] 生成總結錯誤:', error.message);
      throw new Error(`生成產品評語失敗: ${error.message}`);
    }
  }

}

/**
 * 單例實例
 */
let instance: AIService | null = null;

/**
 * 取得 AI 服務單例
 */
export function getAIService(config?: Partial<GeminiConfig>): AIService {
  if (!instance) {
    instance = new AIService(config);
  }
  return instance;
}

