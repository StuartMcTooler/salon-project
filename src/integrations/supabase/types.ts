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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      business_accounts: {
        Row: {
          address: string | null
          business_name: string
          business_type: Database["public"]["Enums"]["business_type"]
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          owner_user_id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          business_type: Database["public"]["Enums"]["business_type"]
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          owner_user_id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          owner_user_id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          business_id: string | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          staff_id: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          staff_id?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          staff_id?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      c2c_revenue_share: {
        Row: {
          created_at: string | null
          id: string
          invited_creative_id: string
          inviter_creative_id: string
          paid_at: string | null
          referral_transaction_id: string
          share_amount: number
          share_percentage: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_creative_id: string
          inviter_creative_id: string
          paid_at?: string | null
          referral_transaction_id: string
          share_amount: number
          share_percentage?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_creative_id?: string
          inviter_creative_id?: string
          paid_at?: string | null
          referral_transaction_id?: string
          share_amount?: number
          share_percentage?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "c2c_revenue_share_invited_creative_id_fkey"
            columns: ["invited_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "c2c_revenue_share_inviter_creative_id_fkey"
            columns: ["inviter_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "c2c_revenue_share_referral_transaction_id_fkey"
            columns: ["referral_transaction_id"]
            isOneToOne: false
            referencedRelation: "referral_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_ownership: {
        Row: {
          client_email: string
          client_name: string | null
          client_phone: string | null
          creative_id: string
          id: string
          source: string
          tagged_at: string | null
        }
        Insert: {
          client_email: string
          client_name?: string | null
          client_phone?: string | null
          creative_id: string
          id?: string
          source: string
          tagged_at?: string | null
        }
        Update: {
          client_email?: string
          client_name?: string | null
          client_phone?: string | null
          creative_id?: string
          id?: string
          source?: string
          tagged_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_ownership_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_invites: {
        Row: {
          created_at: string | null
          id: string
          invite_code: string
          invited_creative_id: string | null
          inviter_creative_id: string
          signup_completed_at: string | null
          tenth_booking_completed_at: string | null
          upfront_bonus_amount: number | null
          upfront_bonus_paid: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invite_code: string
          invited_creative_id?: string | null
          inviter_creative_id: string
          signup_completed_at?: string | null
          tenth_booking_completed_at?: string | null
          upfront_bonus_amount?: number | null
          upfront_bonus_paid?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invite_code?: string
          invited_creative_id?: string | null
          inviter_creative_id?: string
          signup_completed_at?: string | null
          tenth_booking_completed_at?: string | null
          upfront_bonus_amount?: number | null
          upfront_bonus_paid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_invites_invited_creative_id_fkey"
            columns: ["invited_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_invites_inviter_creative_id_fkey"
            columns: ["inviter_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_loyalty_settings: {
        Row: {
          birthday_bonus: number | null
          created_at: string
          creative_id: string
          first_visit_bonus: number | null
          id: string
          is_active: boolean
          milestone_100_bonus: number | null
          milestone_1000_bonus: number | null
          milestone_500_bonus: number | null
          override_points_per_euro: number | null
          override_redemption_value: number | null
          referral_bonus: number | null
          updated_at: string
        }
        Insert: {
          birthday_bonus?: number | null
          created_at?: string
          creative_id: string
          first_visit_bonus?: number | null
          id?: string
          is_active?: boolean
          milestone_100_bonus?: number | null
          milestone_1000_bonus?: number | null
          milestone_500_bonus?: number | null
          override_points_per_euro?: number | null
          override_redemption_value?: number | null
          referral_bonus?: number | null
          updated_at?: string
        }
        Update: {
          birthday_bonus?: number | null
          created_at?: string
          creative_id?: string
          first_visit_bonus?: number | null
          id?: string
          is_active?: boolean
          milestone_100_bonus?: number | null
          milestone_1000_bonus?: number | null
          milestone_500_bonus?: number | null
          override_points_per_euro?: number | null
          override_redemption_value?: number | null
          referral_bonus?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_loyalty_settings_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: true
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_referral_terms: {
        Row: {
          commission_percentage: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at: string | null
          creative_id: string
          id: string
          is_active: boolean | null
          revenue_share_duration_months: number | null
          updated_at: string | null
        }
        Insert: {
          commission_percentage: number
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string | null
          creative_id: string
          id?: string
          is_active?: boolean | null
          revenue_share_duration_months?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_percentage?: number
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string | null
          creative_id?: string
          id?: string
          is_active?: boolean | null
          revenue_share_duration_months?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_referral_terms_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: true
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty_points: {
        Row: {
          created_at: string
          creative_id: string
          current_balance: number
          customer_email: string
          customer_name: string
          customer_phone: string | null
          first_visit_date: string
          id: string
          last_visit_date: string
          lifetime_earned: number
          lifetime_redeemed: number
          total_visits: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creative_id: string
          current_balance?: number
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          first_visit_date?: string
          id?: string
          last_visit_date?: string
          lifetime_earned?: number
          lifetime_redeemed?: number
          total_visits?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creative_id?: string
          current_balance?: number
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          first_visit_date?: string
          id?: string
          last_visit_date?: string
          lifetime_earned?: number
          lifetime_redeemed?: number
          total_visits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_points_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          audio_sentiment: string | null
          audio_sentiment_score: number | null
          audio_transcript: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          feedback_text: string
          id: string
          order_id: string | null
          sentiment: string | null
          sentiment_score: number | null
          text_sentiment: string | null
          text_sentiment_score: number | null
        }
        Insert: {
          audio_sentiment?: string | null
          audio_sentiment_score?: number | null
          audio_transcript?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          feedback_text: string
          id?: string
          order_id?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          text_sentiment?: string | null
          text_sentiment_score?: number | null
        }
        Update: {
          audio_sentiment?: string | null
          audio_sentiment_score?: number | null
          audio_transcript?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          feedback_text?: string
          id?: string
          order_id?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          text_sentiment?: string | null
          text_sentiment_score?: number | null
        }
        Relationships: []
      }
      loyalty_program_settings: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_enabled: boolean
          min_points_for_redemption: number
          points_expiry_days: number | null
          points_per_euro_spent: number
          points_redemption_value: number
          updated_at: string
          welcome_bonus_points: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          min_points_for_redemption?: number
          points_expiry_days?: number | null
          points_per_euro_spent?: number
          points_redemption_value?: number
          updated_at?: string
          welcome_bonus_points?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          min_points_for_redemption?: number
          points_expiry_days?: number | null
          points_per_euro_spent?: number
          points_redemption_value?: number
          updated_at?: string
          welcome_bonus_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_program_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          appointment_id: string | null
          balance_after: number
          booking_amount: number | null
          created_at: string
          creative_id: string
          customer_email: string
          id: string
          notes: string | null
          points_change: number
          transaction_type: string
        }
        Insert: {
          appointment_id?: string | null
          balance_after: number
          booking_amount?: number | null
          created_at?: string
          creative_id: string
          customer_email: string
          id?: string
          notes?: string | null
          points_change: number
          transaction_type: string
        }
        Update: {
          appointment_id?: string | null
          balance_after?: number
          booking_amount?: number | null
          created_at?: string
          creative_id?: string
          customer_email?: string
          id?: string
          notes?: string | null
          points_change?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "salon_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_delivery_address: string | null
          email: string
          id: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_delivery_address?: string | null
          email: string
          id?: string
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_delivery_address?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          referrer_email: string
          referrer_name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referrer_email: string
          referrer_name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referrer_email?: string
          referrer_name?: string
        }
        Relationships: []
      }
      referral_transactions: {
        Row: {
          appointment_id: string
          booking_amount: number
          client_email: string
          commission_amount: number
          commission_percentage: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at: string | null
          id: string
          paid_at: string | null
          receiver_creative_id: string
          referrer_creative_id: string | null
          revenue_share_end_date: string | null
          status: string | null
        }
        Insert: {
          appointment_id: string
          booking_amount: number
          client_email: string
          commission_amount: number
          commission_percentage: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at?: string | null
          id?: string
          paid_at?: string | null
          receiver_creative_id: string
          referrer_creative_id?: string | null
          revenue_share_end_date?: string | null
          status?: string | null
        }
        Update: {
          appointment_id?: string
          booking_amount?: number
          client_email?: string
          commission_amount?: number
          commission_percentage?: number
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string | null
          id?: string
          paid_at?: string | null
          receiver_creative_id?: string
          referrer_creative_id?: string | null
          revenue_share_end_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "salon_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_transactions_receiver_creative_id_fkey"
            columns: ["receiver_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_transactions_referrer_creative_id_fkey"
            columns: ["referrer_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_appointments: {
        Row: {
          appointment_date: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          duration_minutes: number
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          price: number
          service_id: string | null
          service_name: string
          staff_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          appointment_date?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          duration_minutes: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price: number
          service_id?: string | null
          service_name: string
          staff_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          price?: number
          service_id?: string | null
          service_name?: string
          staff_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          suggested_price: number | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          suggested_price?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          suggested_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          bio: string | null
          business_id: string | null
          commission_rate: number | null
          created_at: string
          display_name: string
          email: string | null
          full_name: string
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          phone: string | null
          profile_image_url: string | null
          skill_level: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          business_id?: string | null
          commission_rate?: number | null
          created_at?: string
          display_name: string
          email?: string | null
          full_name: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          profile_image_url?: string | null
          skill_level?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          business_id?: string | null
          commission_rate?: number | null
          created_at?: string
          display_name?: string
          email?: string | null
          full_name?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          profile_image_url?: string | null
          skill_level?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_service_pricing: {
        Row: {
          created_at: string
          custom_price: number
          id: string
          is_available: boolean | null
          service_id: string | null
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_price: number
          id?: string
          is_available?: boolean | null
          service_id?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_price?: number
          id?: string
          is_available?: boolean | null
          service_id?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_service_pricing_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_service_pricing_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_settings: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          reader_id: string
          reader_name: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reader_id: string
          reader_name?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reader_id?: string
          reader_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trusted_network: {
        Row: {
          added_at: string | null
          alpha_creative_id: string
          colleague_creative_id: string
          id: string
        }
        Insert: {
          added_at?: string | null
          alpha_creative_id: string
          colleague_creative_id: string
          id?: string
        }
        Update: {
          added_at?: string | null
          alpha_creative_id?: string
          colleague_creative_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trusted_network_alpha_creative_id_fkey"
            columns: ["alpha_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_network_colleague_creative_id_fkey"
            columns: ["colleague_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          created_at: string
          credit_type: string
          customer_email: string
          discount_percentage: number
          expires_at: string | null
          id: string
          order_id: string | null
          staff_id: string | null
          used: boolean
          used_at: string | null
          voucher_code: string | null
        }
        Insert: {
          created_at?: string
          credit_type: string
          customer_email: string
          discount_percentage: number
          expires_at?: string | null
          id?: string
          order_id?: string | null
          staff_id?: string | null
          used?: boolean
          used_at?: string | null
          voucher_code?: string | null
        }
        Update: {
          created_at?: string
          credit_type?: string
          customer_email?: string
          discount_percentage?: number
          expires_at?: string | null
          id?: string
          order_id?: string | null
          staff_id?: string | null
          used?: boolean
          used_at?: string | null
          voucher_code?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      walk_in_settings: {
        Row: {
          allow_walk_ins: boolean | null
          business_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          walk_in_buffer_minutes: number | null
          walk_in_notice_text: string | null
        }
        Insert: {
          allow_walk_ins?: boolean | null
          business_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          walk_in_buffer_minutes?: number | null
          walk_in_notice_text?: string | null
        }
        Update: {
          allow_walk_ins?: boolean | null
          business_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          walk_in_buffer_minutes?: number | null
          walk_in_notice_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "walk_in_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_user_to_staff: {
        Args: { _staff_id: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
      business_type: "multi_staff_salon" | "solo_professional"
      commission_type: "finders_fee" | "revenue_share"
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
    Enums: {
      app_role: ["admin", "staff", "user"],
      business_type: ["multi_staff_salon", "solo_professional"],
      commission_type: ["finders_fee", "revenue_share"],
    },
  },
} as const
