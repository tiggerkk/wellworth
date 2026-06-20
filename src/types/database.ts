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
      activity: {
        Row: {
          created_at: string
          default_duration_min: number
          default_effort: string
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          met_by_effort: Json
          name: string
          template: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_duration_min?: number
          default_effort: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          met_by_effort?: Json
          name: string
          template: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_duration_min?: number
          default_effort?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          met_by_effort?: Json
          name?: string
          template?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_entry: {
        Row: {
          asset_type: string
          created_at: string
          currency: string
          details: Json
          fx_rate_to_base: number
          id: string
          name: string
          snapshot_id: string
          sort_order: number | null
          updated_at: string
          user_id: string
          value_base: number
          value_native: number
        }
        Insert: {
          asset_type: string
          created_at?: string
          currency: string
          details?: Json
          fx_rate_to_base?: number
          id?: string
          name: string
          snapshot_id: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
          value_base?: number
          value_native?: number
        }
        Update: {
          asset_type?: string
          created_at?: string
          currency?: string
          details?: Json
          fx_rate_to_base?: number
          id?: string
          name?: string
          snapshot_id?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
          value_base?: number
          value_native?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_entry_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "networth_snapshot"
            referencedColumns: ["id"]
          },
        ]
      }
      book: {
        Row: {
          authors: string[] | null
          comments: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          end_date: string | null
          genres: string[] | null
          google_books_id: string | null
          id: string
          isbn: string | null
          language: string | null
          last_update_date: string | null
          lgbtq_rep: string
          open_library_id: string | null
          page_count: number | null
          rating: number | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          authors?: string[] | null
          comments?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          isbn?: string | null
          language?: string | null
          last_update_date?: string | null
          lgbtq_rep?: string
          open_library_id?: string | null
          page_count?: number | null
          rating?: number | null
          start_date?: string | null
          status: string
          title: string
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          authors?: string[] | null
          comments?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          isbn?: string | null
          language?: string | null
          last_update_date?: string | null
          lgbtq_rep?: string
          open_library_id?: string | null
          page_count?: number | null
          rating?: number | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      diary_entry: {
        Row: {
          activity_id: string | null
          amount: number | null
          created_at: string
          day: string
          duration_min: number | null
          effort: string | null
          energy_kcal: number
          food_id: string | null
          group_name: string
          id: string
          kind: string
          label: string
          nutrients: Json
          serving_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          amount?: number | null
          created_at?: string
          day: string
          duration_min?: number | null
          effort?: string | null
          energy_kcal?: number
          food_id?: string | null
          group_name: string
          id?: string
          kind: string
          label: string
          nutrients?: Json
          serving_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          amount?: number | null
          created_at?: string
          day?: string
          duration_min?: number | null
          effort?: string | null
          energy_kcal?: number
          food_id?: string | null
          group_name?: string
          id?: string
          kind?: string
          label?: string
          nutrients?: Json
          serving_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entry_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entry_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entry_serving_id_fkey"
            columns: ["serving_id"]
            isOneToOne: false
            referencedRelation: "serving"
            referencedColumns: ["id"]
          },
        ]
      }
      food: {
        Row: {
          created_at: string
          deleted_at: string | null
          external_id: string | null
          id: string
          is_favorite: boolean
          name: string
          nutrient_basis: string
          nutrients: Json
          source: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          id?: string
          is_favorite?: boolean
          name: string
          nutrient_basis?: string
          nutrients?: Json
          source: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          id?: string
          is_favorite?: boolean
          name?: string
          nutrient_basis?: string
          nutrients?: Json
          source?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      networth_snapshot: {
        Row: {
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrient: {
        Row: {
          category: string
          default_visible: boolean
          display_name: string
          has_upper_limit: boolean
          key: string
          parent_key: string | null
          sort_order: number
          unit: string
        }
        Insert: {
          category: string
          default_visible?: boolean
          display_name: string
          has_upper_limit?: boolean
          key: string
          parent_key?: string | null
          sort_order?: number
          unit: string
        }
        Update: {
          category?: string
          default_visible?: boolean
          display_name?: string
          has_upper_limit?: boolean
          key?: string
          parent_key?: string | null
          sort_order?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrient_parent_key_fkey"
            columns: ["parent_key"]
            isOneToOne: false
            referencedRelation: "nutrient"
            referencedColumns: ["key"]
          },
        ]
      }
      profile: {
        Row: {
          activity_factor: number
          birthday: string | null
          book_importer_enabled: boolean
          book_visible_fields: string[] | null
          created_at: string
          height_cm: number | null
          highlighted_nutrients: string[]
          protein_target_g: number | null
          quote_importer_enabled: boolean
          quote_visible_fields: string[] | null
          sex: string | null
          show_importer_enabled: boolean
          show_visible_fields: string[] | null
          units: string
          updated_at: string
          user_id: string
          visible_nutrients: string[]
          weight_kg: number | null
        }
        Insert: {
          activity_factor?: number
          birthday?: string | null
          book_importer_enabled?: boolean
          book_visible_fields?: string[] | null
          created_at?: string
          height_cm?: number | null
          highlighted_nutrients?: string[]
          protein_target_g?: number | null
          quote_importer_enabled?: boolean
          quote_visible_fields?: string[] | null
          sex?: string | null
          show_importer_enabled?: boolean
          show_visible_fields?: string[] | null
          units?: string
          updated_at?: string
          user_id: string
          visible_nutrients?: string[]
          weight_kg?: number | null
        }
        Update: {
          activity_factor?: number
          birthday?: string | null
          book_importer_enabled?: boolean
          book_visible_fields?: string[] | null
          created_at?: string
          height_cm?: number | null
          highlighted_nutrients?: string[]
          protein_target_g?: number | null
          quote_importer_enabled?: boolean
          quote_visible_fields?: string[] | null
          sex?: string | null
          show_importer_enabled?: boolean
          show_visible_fields?: string[] | null
          units?: string
          updated_at?: string
          user_id?: string
          visible_nutrients?: string[]
          weight_kg?: number | null
        }
        Relationships: []
      }
      quote: {
        Row: {
          author: string | null
          book_id: string | null
          category: string
          created_at: string
          id: string
          is_favorite: boolean
          language: string
          show_id: string | null
          source_type: string
          tags: string[]
          text: string
          text_norm: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          book_id?: string | null
          category: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          language?: string
          show_id?: string | null
          source_type: string
          tags?: string[]
          text: string
          text_norm?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          book_id?: string | null
          category?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          language?: string
          show_id?: string | null
          source_type?: string
          tags?: string[]
          text?: string
          text_norm?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "show"
            referencedColumns: ["id"]
          },
        ]
      }
      serving: {
        Row: {
          food_id: string
          grams: number
          id: string
          name: string
        }
        Insert: {
          food_id: string
          grams: number
          id?: string
          name: string
        }
        Update: {
          food_id?: string
          grams?: number
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "serving_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food"
            referencedColumns: ["id"]
          },
        ]
      }
      show: {
        Row: {
          cast: string[] | null
          comments: string | null
          created_at: string
          director: string | null
          end_date: string | null
          genres: string[] | null
          id: string
          imdb_id: string | null
          last_update_date: string | null
          lgbtq_rep: string
          master_series: string | null
          original_language: string | null
          original_title: string | null
          overview: string | null
          poster_path: string | null
          rating: number | null
          runtime_min: number | null
          start_date: string | null
          status: string
          title: string
          tmdb_id: number | null
          total_episodes: number | null
          total_seasons: number | null
          type: string
          updated_at: string
          user_id: string
          watched_episodes: number | null
          watched_seasons: number | null
          year: number | null
        }
        Insert: {
          cast?: string[] | null
          comments?: string | null
          created_at?: string
          director?: string | null
          end_date?: string | null
          genres?: string[] | null
          id?: string
          imdb_id?: string | null
          last_update_date?: string | null
          lgbtq_rep?: string
          master_series?: string | null
          original_language?: string | null
          original_title?: string | null
          overview?: string | null
          poster_path?: string | null
          rating?: number | null
          runtime_min?: number | null
          start_date?: string | null
          status: string
          title: string
          tmdb_id?: number | null
          total_episodes?: number | null
          total_seasons?: number | null
          type: string
          updated_at?: string
          user_id: string
          watched_episodes?: number | null
          watched_seasons?: number | null
          year?: number | null
        }
        Update: {
          cast?: string[] | null
          comments?: string | null
          created_at?: string
          director?: string | null
          end_date?: string | null
          genres?: string[] | null
          id?: string
          imdb_id?: string | null
          last_update_date?: string | null
          lgbtq_rep?: string
          master_series?: string | null
          original_language?: string | null
          original_title?: string | null
          overview?: string | null
          poster_path?: string | null
          rating?: number | null
          runtime_min?: number | null
          start_date?: string | null
          status?: string
          title?: string
          tmdb_id?: number | null
          total_episodes?: number | null
          total_seasons?: number | null
          type?: string
          updated_at?: string
          user_id?: string
          watched_episodes?: number | null
          watched_seasons?: number | null
          year?: number | null
        }
        Relationships: []
      }
      strength_set: {
        Row: {
          entry_id: string
          exercise: string
          id: string
          reps: number | null
          set_number: number
          weight: number | null
          weight_unit: string | null
        }
        Insert: {
          entry_id: string
          exercise: string
          id?: string
          reps?: number | null
          set_number: number
          weight?: number | null
          weight_unit?: string | null
        }
        Update: {
          entry_id?: string
          exercise?: string
          id?: string
          reps?: number | null
          set_number?: number
          weight?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strength_set_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entry"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
