export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      official_ingredients: {
        Row: {
          id: string
          inci_name: string
          limit_standard: string | null
          skin_type_risks: Json | null
          warning_text: string | null
        }
        Insert: {
          id?: string
          inci_name: string
          limit_standard?: string | null
          skin_type_risks?: Json | null
          warning_text?: string | null
        }
        Update: {
          id?: string
          inci_name?: string
          limit_standard?: string | null
          skin_type_risks?: Json | null
          warning_text?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_group: string | null
          base_skin_type: string
          birth_year: number | null
          created_at: string | null
          gender: string | null
          id: string
          issues: string | null
          updated_at: string | null
        }
        Insert: {
          age_group?: string | null
          base_skin_type: string
          birth_year?: number | null
          created_at?: string | null
          gender?: string | null
          id: string
          issues?: string | null
          updated_at?: string | null
        }
        Update: {
          age_group?: string | null
          base_skin_type?: string
          birth_year?: number | null
          created_at?: string | null
          gender?: string | null
          id?: string
          issues?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      routine_items: {
        Row: {
          created_at: string | null
          day_of_week: number
          id: string
          ingredients: string[] | null
          is_locked: boolean | null
          is_recommendation: boolean | null
          notes: string | null
          product_category: string | null
          product_id: string | null
          product_name: string
          recommendation_reason: string | null
          routine_id: string
          sequence_order: number
          time_of_day: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          id?: string
          ingredients?: string[] | null
          is_locked?: boolean | null
          is_recommendation?: boolean | null
          notes?: string | null
          product_category?: string | null
          product_id?: string | null
          product_name: string
          recommendation_reason?: string | null
          routine_id: string
          sequence_order?: number
          time_of_day: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          id?: string
          ingredients?: string[] | null
          is_locked?: boolean | null
          is_recommendation?: boolean | null
          notes?: string | null
          product_category?: string | null
          product_id?: string | null
          product_name?: string
          recommendation_reason?: string | null
          routine_id?: string
          sequence_order?: number
          time_of_day?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "user_cabinet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_items_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          created_at: string | null
          created_by_ai: boolean | null
          custom_themes: string[]
          description: string | null
          gemini_prompt_used: string | null
          id: string
          is_active: boolean | null
          name: string
          themes: string[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by_ai?: boolean | null
          custom_themes?: string[]
          description?: string | null
          gemini_prompt_used?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          themes?: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by_ai?: boolean | null
          custom_themes?: string[]
          description?: string | null
          gemini_prompt_used?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          themes?: string[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cabinet: {
        Row: {
          analysis_result: Json | null
          created_at: string | null
          id: string
          product_category: string | null
          product_name: string
          raw_ingredients: Json
          user_id: string | null
        }
        Insert: {
          analysis_result?: Json | null
          created_at?: string | null
          id?: string
          product_category?: string | null
          product_name: string
          raw_ingredients: Json
          user_id?: string | null
        }
        Update: {
          analysis_result?: Json | null
          created_at?: string | null
          id?: string
          product_category?: string | null
          product_name?: string
          raw_ingredients?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_cabinet_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_routine_item_orders: {
        Args: { p_routine_id: string; p_updates: Json; p_user_id: string }
        Returns: {
          message: string
          success: boolean
          updated_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
