// server/api/analyze.post.ts
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// 定義有效的膚質類型
const VALID_SKIN_TYPES = ['oily', 'dry', 'combination', 'sensitive', 'normal'];

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const supabase = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceKey
  );
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);

  try {
    const body = await readBody(event);
    const { imageBase64, skinType } = body;

    if (!imageBase64) {
      throw createError({ statusCode: 400, statusMessage: '缺少必要參數：imageBase64' });
    }

    // 驗證膚質類型（非必須，但若提供則必須有效）
    if (skinType && !VALID_SKIN_TYPES.includes(skinType)) {
      throw createError({ 
        statusCode: 400, 
        statusMessage: `無效的膚質類型。有效值：${VALID_SKIN_TYPES.join(', ')}` 
      });
    }

    // 1. 清洗 Base64 (去除可能來自前端的 data:image/jpeg;base64, 前綴)
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // 2. 設定 Gemini 模型與嚴格的 System Prompt
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `你是一位國際頂尖的化妝品配方師與影像辨識專家。
你的唯一任務是：辨識使用者上傳的保養品成分表照片，提取所有成分，並將其正規化。
嚴格規則：
1. 將所有語言（包含中文、日文、韓文）、俗名或錯別字，強制精確翻譯為標準的「INCI Name (國際化妝品原料命名)」，全英文。
2. 忽略標點符號、濃度百分比、用途說明等非成分資訊。
3. 你的輸出必須是一個純粹的字串陣列 (JSON Array)。
4. 絕對不可包含任何解釋、問候語、Markdown 標記 (如 \`\`\`json) 或其他廢話。`,
      generationConfig: {
        temperature: 0.1, // 降低隨機性，提高翻譯與格式穩定性
        responseMimeType: "application/json",
        // 強制鎖死輸出格式為 Array of Strings
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.STRING,
          },
        },
      },
    });

    // 3. 呼叫 Gemini API
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg", // 即使是 png，Gemini API 也能自動相容解析
        },
      },
      "請萃取圖片中的成分，並依照指示回傳 INCI Array。"
    ]);

    // 4. 取得並解析結果 (因為已鎖死 JSON，可安全 parse)
    const responseText = result.response.text();
    const inciArray: string[] = JSON.parse(responseText);

    if (!Array.isArray(inciArray) || inciArray.length === 0) {
      throw new Error("AI 無法從圖片中辨識出任何有效成分");
    }

    // 5. 查詢 Supabase official_ingredients 進行比對
    const { data: matchedIngredients, error: dbError } = await supabase
      .from('official_ingredients')
      .select('inci_name, limit_standard, warning_text, skin_type_risks')
      .in('inci_name', inciArray); // 核心：一次性丟入整個陣列進行比對，並取得膚質風險數據

    if (dbError) {
      throw createError({ statusCode: 500, statusMessage: '資料庫比對失敗' });
    }

    // 6. 雙重過濾分類引擎 -- 法規警告 + 膚質個性化警告
    const regulatoryAlerts: any[] = [];
    const skinTypeAlerts: any[] = [];
    const flaggedInciNames = new Set<string>(); // 使用 Set 提升性能

    if (matchedIngredients && matchedIngredients.length > 0) {
      matchedIngredients.forEach((dbIng: any) => {
        // 檢查 A: 法規警告 (必絕/限量)
        if (dbIng.warning_text || dbIng.limit_standard) {
          regulatoryAlerts.push({
            inci_name: dbIng.inci_name,
            warning: dbIng.warning_text,
            limit: dbIng.limit_standard,
            severity: 'critical' // 法規是最高優先級
          });
          flaggedInciNames.add(dbIng.inci_name);
        }

        // 檢查 B: 膚質個性化警告
        if (skinType) {
          // 防禦性檢查：確保 skin_type_risks 是物件格式
          if (dbIng.skin_type_risks && typeof dbIng.skin_type_risks === 'object' && !Array.isArray(dbIng.skin_type_risks)) {
            const riskForSkinType = dbIng.skin_type_risks[skinType];
            if (riskForSkinType) {
              skinTypeAlerts.push({
                inci_name: dbIng.inci_name,
                risk_description: riskForSkinType,
                severity: 'warning' // 膚質警告為次級
              });
              flaggedInciNames.add(dbIng.inci_name);
            }
          }
        }
      });
    }

    // 計算安全/未知成分（使用 Set 提升性能）
    const safeOrUnknownIngredients = inciArray.filter(inci => !flaggedInciNames.has(inci));

    // 7. 啟動 AI 引擎進行「配方綜合評估」
    // 使用同一個 model，但不使用 Structured Outputs，讓他自然語言輸出
    const summaryModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.3 } // 稍微給一點靈活性來寫評語
    });

    const skinTypeLabel = skinType || '一般膚質 (未提供)';
    
    // 嚴謹的 Prompt，要求 AI 扮演配方師給出結論
    const summaryPrompt = `
      你是一位專業的化妝品配方師。請根據以下的保養品 INCI 成分表，以及使用者的膚質，給出一段專業、白話且具有價值的整體評價。
      
      成分表：${inciArray.join(', ')}
      使用者膚質：${skinTypeLabel}
      
      嚴格輸出規則：
      1. 點出這支產品的「核心功效」（如：偏向保濕、抗老、酸類煥膚等）。
      2. 針對該使用者的膚質，給出「是否推薦」以及「使用建議或潛在風險」。
      3. 字數限制在 100 字以內，語氣要像專業且溫柔的皮膚科醫生。
      4. 純文字輸出，不可使用任何 Markdown 標記 (如 ** 或 #)。
    `;

    const summaryResult = await summaryModel.generateContent(summaryPrompt);
    const aiSummary = summaryResult.response.text();

    // 8. 最終資料重組與回傳
    return {
      status: 'success',
      message: '雙引擎分析完成',
      data: {
        rawAiOutput: inciArray,
        analysis: {
          regulatoryAlerts, // DB 處理：法規紅燈
          skinTypeAlerts,   // DB 處理：膚質黃燈
          safeList: safeOrUnknownIngredients // DB 未匹配到的成分
        },
        // AI 綜合評估欄位
        overallSummary: aiSummary 
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