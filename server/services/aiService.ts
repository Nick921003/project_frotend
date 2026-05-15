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

import type { UserProfileData, CabinetProduct } from '~/types/routine';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

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

      const imageParts = images.map(b64 => {
        const match = b64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
        const mimeType = (match?.[1] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heif' | 'image/heic'
        const data = match ? b64.replace(/^data:image\/[^;]+;base64,/, '') : b64
        return { inlineData: { data, mimeType } }
      });

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
   * 回傳 overview（100字整體評價）與 verdict（一句話結論）
   */
  async generateProductSummary(
    ingredients: string[],
    skinType: string,
    matchedDbIngredients?: Array<{ inci_name: string; efficacy_tags?: string[]; function_summary?: string | null }>
  ): Promise<{ overview: string; verdict: string }> {
    try {
      const { GoogleGenerativeAI, SchemaType } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.config.apiKey);
      const model = genAI.getGenerativeModel({
        model: this.config.model,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              overview: { type: SchemaType.STRING },
              verdict: { type: SchemaType.STRING }
            },
            required: ['overview', 'verdict']
          }
        }
      });

      const skinTypeLabel = skinType || '一般膚質 (未提供)';

      // 從 DB 取得有 function_summary 的成分，組成結構化 context
      const knownActives = (matchedDbIngredients || [])
        .filter(i => i.function_summary)
        .map(i => {
          const tags = i.efficacy_tags?.length ? `[${i.efficacy_tags.join('/')}] ` : '';
          return `- ${tags}${i.inci_name}：${i.function_summary}`;
        });

      const knownContext = knownActives.length > 0
        ? `\n\n已驗證活性成分（請優先依此說明，不必重新猜測）：\n${knownActives.join('\n')}`
        : '';

      const unknownIngredients = ingredients.filter(
        name => !(matchedDbIngredients || []).some(d => d.inci_name === name && d.function_summary)
      );
      const unknownContext = unknownIngredients.length > 0
        ? `\n\n其餘成分（自行判斷功效）：${unknownIngredients.join(', ')}`
        : '';

      const summaryPrompt = `你是一位專業的化妝品配方師。請根據以下資料，給出產品評價。
${knownContext}${unknownContext}

使用者膚質：${skinTypeLabel}

回傳 JSON：
- overview：100字以內的整體評價，語氣像專業溫柔的皮膚科醫生，純文字無 Markdown。點出核心功效，給出是否推薦。
- verdict：一句話結論（30字以內），格式如「這瓶以保濕為主，適合乾性肌，油性肌效益有限」。`;

      const result = await model.generateContent(summaryPrompt);
      const parsed = JSON.parse(result.response.text());

      console.log('[AIService] 生成產品總結');
      return {
        overview: parsed.overview || '',
        verdict: parsed.verdict || ''
      };
    } catch (error: any) {
      console.error('[AIService] 生成總結錯誤:', error.message);
      throw new Error(`生成產品評語失敗: ${error.message}`);
    }
  }

  private tryParseIngredients(rawIngredients: string | null): string[] {
    if (!rawIngredients) return [];
    try {
      const parsed = JSON.parse(rawIngredients);
      if (Array.isArray(parsed)) return parsed.map(i => typeof i === 'string' ? i : String(i)).slice(0, 10);
    } catch {}
    if (typeof rawIngredients === 'string' && rawIngredients.includes(',')) {
      return rawIngredients.split(',').map(s => s.trim()).filter(s => s.length > 0).slice(0, 10);
    }
    return [rawIngredients];
  }

  /**
   * 根據使用者膚況與現有保養品，生成功效導向補充推薦
   */
  async generateEfficacyRecommendations(
    profile: UserProfileData,
    products: CabinetProduct[],
    targetIssues: string[],
    targetCategories: string[] = []
  ): Promise<Array<{ issue: string; category: string; suggestedIngredients: string[]; reason: string }>> {
    const existingSummary = products.map(p => {
      const ings = this.tryParseIngredients(p.raw_ingredients).slice(0, 8).join(', ');
      return `- ${p.product_name}（${p.product_category}）: ${ings || '成分未知'}`;
    }).join('\n');

    // 品類限制提示
    const categoryConstraint = targetCategories.length > 0
      ? `\n只在以下品類中給出建議：${targetCategories.join('、')}` : ''

    const prompt = `你是一位專業化妝品配方師。以下是使用者資料與現有保養品：

膚質：${profile.base_skin_type}
性別：${profile.gender || '未指定'}（請根據性別推薦適合的保養品，例如男性通常不需要眼霜或化妝水）
困擾：${targetIssues.length > 0 ? targetIssues.join('、') : profile.issues || '一般保養'}
現有產品與主要成分：
${existingSummary || '（無產品）'}

請分析現有產品的成分覆蓋，找出「功效缺口」，針對使用者的困擾給出 2~4 條補充建議。${categoryConstraint}
即使某品類已有產品，也可以推薦含不同功效成分的同品類產品。

以 JSON 陣列回傳，每筆格式如下：
{
  "issue": "對應的困擾（如：控油抗痘）",
  "category": "建議的品類（如：精華液、眼霜）",
  "suggestedIngredients": ["成分1", "成分2"],
  "reason": "為什麼需要補充，現有產品缺了什麼（繁體中文，1~2句）"
}

只回傳 JSON 陣列，不要其他文字。`;

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.config.apiKey);
      const model = genAI.getGenerativeModel({
        model: this.config.model,
        generationConfig: { temperature: 0.4 }
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      console.warn('[AIService] generateEfficacyRecommendations 失敗:', e.message);
      return [];
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

