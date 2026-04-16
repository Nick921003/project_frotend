/**
 * types/routine.ts
 * 保養規劃相關的 TypeScript 定義
 */

/**
 * 排程配置偏好
 */
export interface RoutinePreferences {
  // 保養複雜度：'minimal' 簡易 | 'standard' 標準 | 'comprehensive' 完整
  complexity: 'minimal' | 'standard' | 'comprehensive';
  
  // 針對的肌膚問題
  targetIssues: string[];
  
  // 優先順序：'speed' 快速 | 'effectiveness' 有效性 | 'affordability' 經濟
  priority: 'speed' | 'effectiveness' | 'affordability';
  
  // 是否允許推薦新產品
  allowRecommendations: boolean;
  
  // 推薦邊界：產品數量下限，少於此時建議推薦
  recommendThreshold: number;
}

/**
 * 使用者個人資料（簡化版）
 */
export interface UserProfileData {
  id: string;
  base_skin_type: string;
  gender: 'male' | 'female' | 'other' | null;
  birth_year: number | null;
  issues: string | null;
}

/**
 * user_cabinet 表的產品數據
 */
export interface CabinetProduct {
  id: string;
  user_id: string;
  product_name: string;
  product_category: string;
  raw_ingredients: string; // JSON string
  analysis_result: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

/**
 * 單一排程項目
 */
export interface RoutineItem {
  id?: string; // 如果是新建項目，可以為空
  routine_id?: string;
  user_id?: string;
  product_id?: string | null;
  day_of_week: number; // 0-6 (星期日-星期六)
  time_of_day: 'morning' | 'evening';
  sequence_order: number;
  product_name: string;
  product_category?: string;
  ingredients?: string[];
  is_recommendation: boolean; // true 表示此為 AI 建議添購
  is_locked?: boolean; // true 表示鎖定，AI 不會調整/刪除
  recommendation_reason?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 排程主題/類型選項
 */
export interface RoutineTheme {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const AVAILABLE_ROUTINE_THEMES: RoutineTheme[] = [
  {
    id: 'hydration',
    label: '保濕',
    description: '強化肌膚含水量，改善乾燥',
    icon: '💧'
  },
  {
    id: 'anti-aging',
    label: '抗衰老',
    description: '減少細紋，提升肌膚彈性',
    icon: '⏰'
  },
  {
    id: 'acne-control',
    label: '控油抗痘',
    description: '深層淨化，控制油脂分泌',
    icon: '🎯'
  },
  {
    id: 'repair',
    label: '修護',
    description: '舒緩肌膚，恢復健康狀態',
    icon: '🛡️'
  },
  {
    id: 'brightening',
    label: '亮白',
    description: '均勻膚色，提升光澤感',
    icon: '✨'
  },
  {
    id: 'sensitivity',
    label: '舒敏',
    description: '溫和護理，減少刺激',
    icon: '🍃'
  },
  {
    id: 'exfoliation',
    label: '刷酸',
    description: '去除老廢角質，促進更新',
    icon: '🧪'
  }
];

/**
 * 產品庫存項目
 */
export interface CabinetProductItem {
  id: string;
  product_name: string;
  product_category: string;
  raw_ingredients: string;
  is_recommendation: boolean;
}

export interface RoutineRecommendation {
  product_name: string;
  product_category?: string;
  ingredients?: string[];
  recommendation_reason?: string;
}

/**
 * 完整的每週保養規劃
 */
export interface WeeklyRoutine {
  routine_id?: string;
  name: string;
  description?: string;
  items: RoutineItem[];
  recommendations?: RoutineRecommendation[];
  is_active: boolean;
  created_by_ai: boolean;
  gemini_prompt_used?: string;
  all_products?: CabinetProductItem[];
  _empty_reason?: 'no_products' | 'no_items'; // 用於前端識別空排程的原因
  themes?: string[]; // 選擇的排程主題/類型（如 'hydration', 'anti-aging' 等）
  custom_themes?: string[]; // 自定義主題
}

/**
 * Gemini API 回應結構（預期的 JSON 格式）
 */
export interface GeminiRoutineResponse {
  name: string;
  description: string;
  items: Array<{
    day_of_week: number;
    time_of_day: 'morning' | 'evening';
    sequence_order: number;
    product_name: string;
    product_category: string;
    ingredients: string[];
    is_recommendation: boolean;
    recommendation_reason?: string;
    notes?: string;
  }>;
}
