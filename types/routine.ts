/**
 * types/routine.ts
 * 保養規劃相關的 TypeScript 定義
 */

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
  overview: string | null;
  created_at: string;
  updated_at: string;
  // 使用追蹤欄位
  opened_at: string | null;
  estimated_finish_days: number | null;
  purchase_purpose: string | null;
  user_notes: string | null;
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
  is_orphan?: boolean; // true 表示對應產品已從保養品櫃刪除
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
  analysis_result?: Record<string, any> | null;
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
  conflicts_by_day?: Record<number, { rule: string; message: string }[]>;
}

