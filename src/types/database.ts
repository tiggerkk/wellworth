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
          cover_url: string | null
          created_at: string
          description: string | null
          dynasty: string | null
          end_date: string | null
          genres: string[] | null
          google_books_id: string | null
          id: string
          is_favorite: boolean
          isbn: string | null
          language: string | null
          lgbtq_rep: string
          notes: string | null
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
          cover_url?: string | null
          created_at?: string
          description?: string | null
          dynasty?: string | null
          end_date?: string | null
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          is_favorite?: boolean
          isbn?: string | null
          language?: string | null
          lgbtq_rep?: string
          notes?: string | null
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
          cover_url?: string | null
          created_at?: string
          description?: string | null
          dynasty?: string | null
          end_date?: string | null
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          is_favorite?: boolean
          isbn?: string | null
          language?: string | null
          lgbtq_rep?: string
          notes?: string | null
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
          sort_order: number
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
          sort_order?: number
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
          sort_order?: number
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
      insurance_policy: {
        Row: {
          created_at: string
          currency: string
          id: string
          notes: string | null
          policy_name: string
          policy_number: string
          provider: string
          start_date: string | null
          surrender_date: string | null
          surrender_proceeds: number | null
          surrendered_from_month: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          notes?: string | null
          policy_name?: string
          policy_number: string
          provider: string
          start_date?: string | null
          surrender_date?: string | null
          surrender_proceeds?: number | null
          surrendered_from_month?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          policy_name?: string
          policy_number?: string
          provider?: string
          start_date?: string | null
          surrender_date?: string | null
          surrender_proceeds?: number | null
          surrendered_from_month?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      insurance_schedule: {
        Row: {
          created_at: string
          effective_date: string | null
          first_year: number
          id: string
          imported_at: string
          kind: string
          policy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date?: string | null
          first_year: number
          id?: string
          imported_at?: string
          kind: string
          policy_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string | null
          first_year?: number
          id?: string
          imported_at?: string
          kind?: string
          policy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_schedule_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policy"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_schedule_point: {
        Row: {
          age: number
          cash_value: number
          id: string
          policy_year: number
          schedule_id: string
          total_premium_paid: number
        }
        Insert: {
          age: number
          cash_value: number
          id?: string
          policy_year: number
          schedule_id: string
          total_premium_paid: number
        }
        Update: {
          age?: number
          cash_value?: number
          id?: string
          policy_year?: number
          schedule_id?: string
          total_premium_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "insurance_schedule_point_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "insurance_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_lab_test: {
        Row: {
          category: string
          default_tracked: boolean
          default_unit: string | null
          display_name: string
          key: string
          sort_order: number
          value_kind: string
        }
        Insert: {
          category: string
          default_tracked?: boolean
          default_unit?: string | null
          display_name: string
          key: string
          sort_order: number
          value_kind?: string
        }
        Update: {
          category?: string
          default_tracked?: boolean
          default_unit?: string | null
          display_name?: string
          key?: string
          sort_order?: number
          value_kind?: string
        }
        Relationships: []
      }
      medical_report: {
        Row: {
          body_part: string | null
          created_at: string
          document_urls: string[]
          id: string
          narrative: string | null
          provider: string | null
          report_date: string
          report_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_part?: string | null
          created_at?: string
          document_urls?: string[]
          id?: string
          narrative?: string | null
          provider?: string | null
          report_date: string
          report_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_part?: string | null
          created_at?: string
          document_urls?: string[]
          id?: string
          narrative?: string | null
          provider?: string | null
          report_date?: string
          report_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medical_result: {
        Row: {
          category: string
          created_at: string
          flag: string | null
          id: string
          normalized: boolean
          ref_high: number | null
          ref_low: number | null
          ref_text: string | null
          report_id: string
          test_key: string | null
          test_name: string
          uncertain: boolean
          unit: string | null
          unit_original: string | null
          updated_at: string
          user_id: string
          value_num: number | null
          value_num_original: number | null
          value_text: string | null
        }
        Insert: {
          category: string
          created_at?: string
          flag?: string | null
          id?: string
          normalized?: boolean
          ref_high?: number | null
          ref_low?: number | null
          ref_text?: string | null
          report_id: string
          test_key?: string | null
          test_name: string
          uncertain?: boolean
          unit?: string | null
          unit_original?: string | null
          updated_at?: string
          user_id: string
          value_num?: number | null
          value_num_original?: number | null
          value_text?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          flag?: string | null
          id?: string
          normalized?: boolean
          ref_high?: number | null
          ref_low?: number | null
          ref_text?: string | null
          report_id?: string
          test_key?: string | null
          test_name?: string
          uncertain?: boolean
          unit?: string | null
          unit_original?: string | null
          updated_at?: string
          user_id?: string
          value_num?: number | null
          value_num_original?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_result_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "medical_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_result_test_key_fkey"
            columns: ["test_key"]
            isOneToOne: false
            referencedRelation: "medical_lab_test"
            referencedColumns: ["key"]
          },
        ]
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
          medical_importer_enabled: boolean
          medical_lock_enabled: boolean
          medical_lock_pin_hash: string | null
          medical_lock_timeout_minutes: number | null
          medical_lock_webauthn_id: string | null
          medical_section_order: string[] | null
          medical_test_order: string[] | null
          medical_tracked_tests: string[] | null
          medical_visible_fields: string[] | null
          module_order: string[] | null
          networth_asset_type_order: string[] | null
          networth_bulk_insurance_import_enabled: boolean
          networth_visible_asset_types: string[] | null
          onboarded_at: string | null
          protein_target_g: number | null
          quote_categories: Json | null
          quote_importer_enabled: boolean
          quote_source_types: Json | null
          quote_visible_fields: string[] | null
          sex: string | null
          show_importer_enabled: boolean
          show_poster_url_visible: boolean
          show_visible_fields: string[] | null
          travel_expense_categories: Json | null
          travel_importer_enabled: boolean
          travel_visible_fields: string[] | null
          units: string
          updated_at: string
          user_id: string
          visible_modules: string[] | null
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
          medical_importer_enabled?: boolean
          medical_lock_enabled?: boolean
          medical_lock_pin_hash?: string | null
          medical_lock_timeout_minutes?: number | null
          medical_lock_webauthn_id?: string | null
          medical_section_order?: string[] | null
          medical_test_order?: string[] | null
          medical_tracked_tests?: string[] | null
          medical_visible_fields?: string[] | null
          module_order?: string[] | null
          networth_asset_type_order?: string[] | null
          networth_bulk_insurance_import_enabled?: boolean
          networth_visible_asset_types?: string[] | null
          onboarded_at?: string | null
          protein_target_g?: number | null
          quote_categories?: Json | null
          quote_importer_enabled?: boolean
          quote_source_types?: Json | null
          quote_visible_fields?: string[] | null
          sex?: string | null
          show_importer_enabled?: boolean
          show_poster_url_visible?: boolean
          show_visible_fields?: string[] | null
          travel_expense_categories?: Json | null
          travel_importer_enabled?: boolean
          travel_visible_fields?: string[] | null
          units?: string
          updated_at?: string
          user_id: string
          visible_modules?: string[] | null
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
          medical_importer_enabled?: boolean
          medical_lock_enabled?: boolean
          medical_lock_pin_hash?: string | null
          medical_lock_timeout_minutes?: number | null
          medical_lock_webauthn_id?: string | null
          medical_section_order?: string[] | null
          medical_test_order?: string[] | null
          medical_tracked_tests?: string[] | null
          medical_visible_fields?: string[] | null
          module_order?: string[] | null
          networth_asset_type_order?: string[] | null
          networth_bulk_insurance_import_enabled?: boolean
          networth_visible_asset_types?: string[] | null
          onboarded_at?: string | null
          protein_target_g?: number | null
          quote_categories?: Json | null
          quote_importer_enabled?: boolean
          quote_source_types?: Json | null
          quote_visible_fields?: string[] | null
          sex?: string | null
          show_importer_enabled?: boolean
          show_poster_url_visible?: boolean
          show_visible_fields?: string[] | null
          travel_expense_categories?: Json | null
          travel_importer_enabled?: boolean
          travel_visible_fields?: string[] | null
          units?: string
          updated_at?: string
          user_id?: string
          visible_modules?: string[] | null
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
      remembered_city: {
        Row: {
          city: string
          city_norm: string | null
          country: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          province: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          city_norm?: string | null
          country: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          province?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          city_norm?: string | null
          country?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          province?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          director: string | null
          dynasty: string | null
          end_date: string | null
          genres: string[] | null
          id: string
          imdb_id: string | null
          is_favorite: boolean
          lgbtq_rep: string
          notes: string | null
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
          created_at?: string
          director?: string | null
          dynasty?: string | null
          end_date?: string | null
          genres?: string[] | null
          id?: string
          imdb_id?: string | null
          is_favorite?: boolean
          lgbtq_rep?: string
          notes?: string | null
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
          created_at?: string
          director?: string | null
          dynasty?: string | null
          end_date?: string | null
          genres?: string[] | null
          id?: string
          imdb_id?: string | null
          is_favorite?: boolean
          lgbtq_rep?: string
          notes?: string | null
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
      stop: {
        Row: {
          city: string | null
          completion: string | null
          country: string | null
          created_at: string
          description: string | null
          details: string | null
          id: string
          province: string | null
          sort_order: number
          trip_day_id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          completion?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          details?: string | null
          id?: string
          province?: string | null
          sort_order: number
          trip_day_id: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          completion?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          details?: string | null
          id?: string
          province?: string | null
          sort_order?: number
          trip_day_id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_day"
            referencedColumns: ["id"]
          },
        ]
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
      trip: {
        Row: {
          base_currency: string
          companions: string | null
          cover_url: string | null
          created_at: string
          end_date: string | null
          fx_rates: Json
          id: string
          name: string
          notes: string | null
          rating: number | null
          start_date: string | null
          status: string
          track_reimbursement: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          companions?: string | null
          cover_url?: string | null
          created_at?: string
          end_date?: string | null
          fx_rates?: Json
          id?: string
          name: string
          notes?: string | null
          rating?: number | null
          start_date?: string | null
          status: string
          track_reimbursement?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          companions?: string | null
          cover_url?: string | null
          created_at?: string
          end_date?: string | null
          fx_rates?: Json
          id?: string
          name?: string
          notes?: string | null
          rating?: number | null
          start_date?: string | null
          status?: string
          track_reimbursement?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_day: {
        Row: {
          created_at: string
          day_date: string | null
          id: string
          label: string | null
          sort_order: number
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_date?: string | null
          id?: string
          label?: string | null
          sort_order: number
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_date?: string | null
          id?: string
          label?: string | null
          sort_order?: number
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_day_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expense: {
        Row: {
          category: string
          cost: number
          created_at: string
          currency: string
          description: string
          expense_date: string | null
          id: string
          reimbursed_amount: number | null
          reimbursed_formula: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          cost: number
          created_at?: string
          currency: string
          description: string
          expense_date?: string | null
          id?: string
          reimbursed_amount?: number | null
          reimbursed_formula?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          currency?: string
          description?: string
          expense_date?: string | null
          id?: string
          reimbursed_amount?: number | null
          reimbursed_formula?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expense_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      medical_latest_result: {
        Row: {
          category: string | null
          created_at: string | null
          flag: string | null
          id: string | null
          normalized: boolean | null
          ref_high: number | null
          ref_low: number | null
          ref_text: string | null
          report_date: string | null
          report_id: string | null
          report_type: string | null
          test_key: string | null
          test_name: string | null
          uncertain: boolean | null
          unit: string | null
          unit_original: string | null
          updated_at: string | null
          user_id: string | null
          value_num: number | null
          value_num_original: number | null
          value_text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_result_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "medical_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_result_test_key_fkey"
            columns: ["test_key"]
            isOneToOne: false
            referencedRelation: "medical_lab_test"
            referencedColumns: ["key"]
          },
        ]
      }
      networth_monthly_type_total: {
        Row: {
          asset_type: string | null
          month: string | null
          total_base: number | null
          user_id: string | null
        }
        Relationships: []
      }
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
