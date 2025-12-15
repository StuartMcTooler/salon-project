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
      auth_otp_requests: {
        Row: {
          client_id: string
          code_hash: string
          created_at: string | null
          expires_at: string
          id: string
          phone_number: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          client_id: string
          code_hash: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone_number: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          client_id?: string
          code_hash?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone_number?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_otp_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
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
          notification_method: string | null
          owner_user_id: string
          phone: string | null
          referral_discount_type:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value: number | null
          smart_slots_enabled: boolean | null
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
          notification_method?: string | null
          owner_user_id: string
          phone?: string | null
          referral_discount_type?:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value?: number | null
          smart_slots_enabled?: boolean | null
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
          notification_method?: string | null
          owner_user_id?: string
          phone?: string | null
          referral_discount_type?:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value?: number | null
          smart_slots_enabled?: boolean | null
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
          {
            foreignKeyName: "business_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
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
            foreignKeyName: "c2c_revenue_share_invited_creative_id_fkey"
            columns: ["invited_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
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
            foreignKeyName: "c2c_revenue_share_inviter_creative_id_fkey"
            columns: ["inviter_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
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
      client_content: {
        Row: {
          ai_metadata: Json | null
          appointment_id: string | null
          approved_at: string | null
          client_approved: boolean
          content_origin: string | null
          created_at: string
          creative_id: string
          enhanced_file_path: string | null
          file_size_bytes: number | null
          id: string
          media_type: string
          points_awarded: boolean
          raw_file_path: string
          request_id: string | null
          visibility_scope: string | null
        }
        Insert: {
          ai_metadata?: Json | null
          appointment_id?: string | null
          approved_at?: string | null
          client_approved?: boolean
          content_origin?: string | null
          created_at?: string
          creative_id: string
          enhanced_file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          media_type: string
          points_awarded?: boolean
          raw_file_path: string
          request_id?: string | null
          visibility_scope?: string | null
        }
        Update: {
          ai_metadata?: Json | null
          appointment_id?: string | null
          approved_at?: string | null
          client_approved?: boolean
          content_origin?: string | null
          created_at?: string
          creative_id?: string
          enhanced_file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          media_type?: string
          points_awarded?: boolean
          raw_file_path?: string
          request_id?: string | null
          visibility_scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_content_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "salon_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_content_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_content_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_content_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "content_requests"
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
          {
            foreignKeyName: "client_ownership_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string | null
          email: string | null
          first_visit_date: string | null
          id: string
          is_test_user: boolean | null
          last_visit_date: string | null
          name: string
          notes: string | null
          phone: string
          primary_creative_id: string | null
          total_visits: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_visit_date?: string | null
          id?: string
          is_test_user?: boolean | null
          last_visit_date?: string | null
          name: string
          notes?: string | null
          phone: string
          primary_creative_id?: string | null
          total_visits?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_visit_date?: string | null
          id?: string
          is_test_user?: boolean | null
          last_visit_date?: string | null
          name?: string
          notes?: string | null
          phone?: string
          primary_creative_id?: string | null
          total_visits?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_primary_creative_id_fkey"
            columns: ["primary_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_primary_creative_id_fkey"
            columns: ["primary_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      content_requests: {
        Row: {
          appointment_id: string
          client_email: string
          client_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          creative_id: string
          id: string
          request_type: string
          status: string
          token: string
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          client_email: string
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          creative_id: string
          id?: string
          request_type?: string
          status?: string
          token: string
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          creative_id?: string
          id?: string
          request_type?: string
          status?: string
          token?: string
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "salon_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_requests_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_requests_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
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
            foreignKeyName: "creative_invites_invited_creative_id_fkey"
            columns: ["invited_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_invites_inviter_creative_id_fkey"
            columns: ["inviter_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_invites_inviter_creative_id_fkey"
            columns: ["inviter_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_lookbooks: {
        Row: {
          added_at: string
          booking_link_enabled: boolean | null
          client_id: string | null
          content_id: string
          creative_id: string
          display_order: number
          id: string
          is_featured: boolean
          private_notes: string | null
          service_id: string | null
          service_price: number | null
          tags: string[] | null
          visibility_scope: string | null
          visibility_type: string | null
        }
        Insert: {
          added_at?: string
          booking_link_enabled?: boolean | null
          client_id?: string | null
          content_id: string
          creative_id: string
          display_order?: number
          id?: string
          is_featured?: boolean
          private_notes?: string | null
          service_id?: string | null
          service_price?: number | null
          tags?: string[] | null
          visibility_scope?: string | null
          visibility_type?: string | null
        }
        Update: {
          added_at?: string
          booking_link_enabled?: boolean | null
          client_id?: string | null
          content_id?: string
          creative_id?: string
          display_order?: number
          id?: string
          is_featured?: boolean
          private_notes?: string | null
          service_id?: string | null
          service_price?: number | null
          tags?: string[] | null
          visibility_scope?: string | null
          visibility_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_lookbooks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_lookbooks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "client_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_lookbooks_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_lookbooks_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_lookbooks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
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
          {
            foreignKeyName: "creative_loyalty_settings_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: true
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_performance_metrics: {
        Row: {
          average_rating: number | null
          cancellation_rate: number | null
          creative_id: string | null
          id: string
          last_booking_date: string | null
          metrics_updated_at: string | null
          total_completed_bookings: number | null
          total_ratings: number | null
          total_revenue: number | null
        }
        Insert: {
          average_rating?: number | null
          cancellation_rate?: number | null
          creative_id?: string | null
          id?: string
          last_booking_date?: string | null
          metrics_updated_at?: string | null
          total_completed_bookings?: number | null
          total_ratings?: number | null
          total_revenue?: number | null
        }
        Update: {
          average_rating?: number | null
          cancellation_rate?: number | null
          creative_id?: string | null
          id?: string
          last_booking_date?: string | null
          metrics_updated_at?: string | null
          total_completed_bookings?: number | null
          total_ratings?: number | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_performance_metrics_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: true
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_performance_metrics_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: true
            referencedRelation: "staff_members_public"
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
          {
            foreignKeyName: "creative_referral_terms_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: true
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty_points: {
        Row: {
          client_id: string | null
          created_at: string
          creative_id: string
          current_balance: number
          customer_email: string | null
          customer_name: string
          customer_phone: string
          deposit_notes: string | null
          first_visit_date: string
          id: string
          last_visit_date: string
          lifetime_earned: number
          lifetime_redeemed: number
          require_booking_deposit: boolean | null
          total_visits: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          creative_id: string
          current_balance?: number
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          deposit_notes?: string | null
          first_visit_date?: string
          id?: string
          last_visit_date?: string
          lifetime_earned?: number
          lifetime_redeemed?: number
          require_booking_deposit?: boolean | null
          total_visits?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          creative_id?: string
          current_balance?: number
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          deposit_notes?: string | null
          first_visit_date?: string
          id?: string
          last_visit_date?: string
          lifetime_earned?: number
          lifetime_redeemed?: number
          require_booking_deposit?: boolean | null
          total_visits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_points_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_points_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_points_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_sessions: {
        Row: {
          client_id: string
          created_at: string | null
          expires_at: string
          id: string
          last_accessed_at: string | null
          remember_me: boolean | null
          session_token: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          last_accessed_at?: string | null
          remember_me?: boolean | null
          session_token: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          remember_me?: boolean | null
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          staff_id: string | null
          star_rating: number | null
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
          staff_id?: string | null
          star_rating?: number | null
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
          staff_id?: string | null
          star_rating?: number | null
          text_sentiment?: string | null
          text_sentiment_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_program_settings: {
        Row: {
          allow_staff_override: boolean | null
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
          allow_staff_override?: boolean | null
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
          allow_staff_override?: boolean | null
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
          customer_email: string | null
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
          customer_email?: string | null
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
          customer_email?: string | null
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
          {
            foreignKeyName: "loyalty_transactions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          business_id: string | null
          created_at: string | null
          delivery_method: string
          error_message: string | null
          id: string
          message_type: string
          recipient_phone: string
          status: string
          twilio_message_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          delivery_method: string
          error_message?: string | null
          id?: string
          message_type: string
          recipient_phone: string
          status: string
          twilio_message_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          delivery_method?: string
          error_message?: string | null
          id?: string
          message_type?: string
          recipient_phone?: string
          status?: string
          twilio_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_rate_limits: {
        Row: {
          attempt_count: number
          created_at: string | null
          id: string
          phone_number: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string | null
          id?: string
          phone_number: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string | null
          id?: string
          phone_number?: string
          window_start?: string
        }
        Relationships: []
      }
      portfolio_approval_requests: {
        Row: {
          client_email: string
          client_id: string | null
          client_name: string
          client_phone: string | null
          content_ids: string[]
          created_at: string | null
          creative_id: string
          id: string
          responded_at: string | null
          status: string | null
          token: string
          token_expires_at: string
        }
        Insert: {
          client_email: string
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          content_ids: string[]
          created_at?: string | null
          creative_id: string
          id?: string
          responded_at?: string | null
          status?: string | null
          token: string
          token_expires_at: string
        }
        Update: {
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          content_ids?: string[]
          created_at?: string | null
          creative_id?: string
          id?: string
          responded_at?: string | null
          status?: string | null
          token?: string
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_approval_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_approval_requests_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_approval_requests_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
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
          referrer_email: string | null
          referrer_name: string
          referrer_phone: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referrer_email?: string | null
          referrer_name: string
          referrer_phone: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referrer_email?: string | null
          referrer_name?: string
          referrer_phone?: string
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
            foreignKeyName: "referral_transactions_receiver_creative_id_fkey"
            columns: ["receiver_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_transactions_referrer_creative_id_fkey"
            columns: ["referrer_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_transactions_referrer_creative_id_fkey"
            columns: ["referrer_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_appointments: {
        Row: {
          appointment_date: string | null
          booking_type: Database["public"]["Enums"]["booking_type_enum"] | null
          client_id: string | null
          created_at: string
          created_by_user_id: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          duration_minutes: number
          id: string
          is_blocked: boolean | null
          list_price: number | null
          notes: string | null
          original_requested_staff_id: string | null
          payment_method: string | null
          payment_processed_by: string | null
          payment_status: string | null
          price: number
          remaining_balance: number | null
          service_id: string | null
          service_name: string
          staff_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          appointment_date?: string | null
          booking_type?: Database["public"]["Enums"]["booking_type_enum"] | null
          client_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          duration_minutes: number
          id?: string
          is_blocked?: boolean | null
          list_price?: number | null
          notes?: string | null
          original_requested_staff_id?: string | null
          payment_method?: string | null
          payment_processed_by?: string | null
          payment_status?: string | null
          price: number
          remaining_balance?: number | null
          service_id?: string | null
          service_name: string
          staff_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string | null
          booking_type?: Database["public"]["Enums"]["booking_type_enum"] | null
          client_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          duration_minutes?: number
          id?: string
          is_blocked?: boolean | null
          list_price?: number | null
          notes?: string | null
          original_requested_staff_id?: string | null
          payment_method?: string | null
          payment_processed_by?: string | null
          payment_status?: string | null
          price?: number
          remaining_balance?: number | null
          service_id?: string | null
          service_name?: string
          staff_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_appointments_original_requested_staff_id_fkey"
            columns: ["original_requested_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_appointments_original_requested_staff_id_fkey"
            columns: ["original_requested_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_appointments_payment_processed_by_fkey"
            columns: ["payment_processed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_appointments_payment_processed_by_fkey"
            columns: ["payment_processed_by"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "salon_appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
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
      smart_slot_rules: {
        Row: {
          business_id: string | null
          created_at: string | null
          day_of_week: number
          deposit_amount: number | null
          end_time: string
          id: string
          is_active: boolean | null
          label: string | null
          modifier_percentage: number
          priority: number
          require_deposit: boolean | null
          rule_type: string
          staff_id: string | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          day_of_week: number
          deposit_amount?: number | null
          end_time: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          modifier_percentage: number
          priority?: number
          require_deposit?: boolean | null
          rule_type: string
          staff_id?: string | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          day_of_week?: number
          deposit_amount?: number | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          modifier_percentage?: number
          priority?: number
          require_deposit?: boolean | null
          rule_type?: string
          staff_id?: string | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_slot_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_slot_rules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_slot_rules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          invite_token: string
          phone: string
          staff_member_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          invite_token: string
          phone: string
          staff_member_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          invite_token?: string
          phone?: string
          staff_member_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          allowed_terminal_types: string[] | null
          area: string | null
          availability_test_days_from_now: number | null
          average_rating: number | null
          bio: string | null
          business_id: string | null
          city: string | null
          commission_rate: number | null
          created_at: string
          deposit_fixed_amount: number | null
          deposit_percentage: number | null
          deposit_type: string | null
          display_name: string
          email: string | null
          full_name: string
          hourly_rate: number | null
          id: string
          is_accepting_referrals: boolean | null
          is_active: boolean | null
          is_test_user: boolean | null
          phone: string | null
          profile_image_url: string | null
          referral_discount_type:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value: number | null
          require_booking_deposit: boolean | null
          simulate_fully_booked: boolean | null
          skill_level: string | null
          specialties: string[] | null
          tier: Database["public"]["Enums"]["creative_tier"] | null
          tier_upgraded_at: string | null
          total_bookings: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          allowed_terminal_types?: string[] | null
          area?: string | null
          availability_test_days_from_now?: number | null
          average_rating?: number | null
          bio?: string | null
          business_id?: string | null
          city?: string | null
          commission_rate?: number | null
          created_at?: string
          deposit_fixed_amount?: number | null
          deposit_percentage?: number | null
          deposit_type?: string | null
          display_name: string
          email?: string | null
          full_name: string
          hourly_rate?: number | null
          id?: string
          is_accepting_referrals?: boolean | null
          is_active?: boolean | null
          is_test_user?: boolean | null
          phone?: string | null
          profile_image_url?: string | null
          referral_discount_type?:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value?: number | null
          require_booking_deposit?: boolean | null
          simulate_fully_booked?: boolean | null
          skill_level?: string | null
          specialties?: string[] | null
          tier?: Database["public"]["Enums"]["creative_tier"] | null
          tier_upgraded_at?: string | null
          total_bookings?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          allowed_terminal_types?: string[] | null
          area?: string | null
          availability_test_days_from_now?: number | null
          average_rating?: number | null
          bio?: string | null
          business_id?: string | null
          city?: string | null
          commission_rate?: number | null
          created_at?: string
          deposit_fixed_amount?: number | null
          deposit_percentage?: number | null
          deposit_type?: string | null
          display_name?: string
          email?: string | null
          full_name?: string
          hourly_rate?: number | null
          id?: string
          is_accepting_referrals?: boolean | null
          is_active?: boolean | null
          is_test_user?: boolean | null
          phone?: string | null
          profile_image_url?: string | null
          referral_discount_type?:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value?: number | null
          require_booking_deposit?: boolean | null
          simulate_fully_booked?: boolean | null
          skill_level?: string | null
          specialties?: string[] | null
          tier?: Database["public"]["Enums"]["creative_tier"] | null
          tier_upgraded_at?: string | null
          total_bookings?: number | null
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
          {
            foreignKeyName: "staff_service_pricing_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      terminal_settings: {
        Row: {
          business_id: string | null
          connection_type: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          reader_id: string | null
          reader_name: string | null
          staff_id: string | null
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          connection_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reader_id?: string | null
          reader_name?: string | null
          staff_id?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          connection_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reader_id?: string | null
          reader_name?: string | null
          staff_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terminal_settings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminal_settings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "trusted_network_alpha_creative_id_fkey"
            columns: ["alpha_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_network_colleague_creative_id_fkey"
            columns: ["colleague_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_network_colleague_creative_id_fkey"
            columns: ["colleague_creative_id"]
            isOneToOne: false
            referencedRelation: "staff_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          created_at: string
          credit_type: string
          customer_email: string | null
          customer_phone: string
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
          customer_email?: string | null
          customer_phone: string
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
          customer_email?: string | null
          customer_phone?: string
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
          business_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      staff_members_public: {
        Row: {
          area: string | null
          availability_test_days_from_now: number | null
          average_rating: number | null
          bio: string | null
          business_id: string | null
          city: string | null
          deposit_fixed_amount: number | null
          deposit_percentage: number | null
          deposit_type: string | null
          display_name: string | null
          id: string | null
          is_accepting_referrals: boolean | null
          is_active: boolean | null
          profile_image_url: string | null
          referral_discount_type:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value: number | null
          require_booking_deposit: boolean | null
          simulate_fully_booked: boolean | null
          skill_level: string | null
          specialties: string[] | null
          tier: Database["public"]["Enums"]["creative_tier"] | null
          total_bookings: number | null
        }
        Insert: {
          area?: string | null
          availability_test_days_from_now?: number | null
          average_rating?: number | null
          bio?: string | null
          business_id?: string | null
          city?: string | null
          deposit_fixed_amount?: number | null
          deposit_percentage?: number | null
          deposit_type?: string | null
          display_name?: string | null
          id?: string | null
          is_accepting_referrals?: boolean | null
          is_active?: boolean | null
          profile_image_url?: string | null
          referral_discount_type?:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value?: number | null
          require_booking_deposit?: boolean | null
          simulate_fully_booked?: boolean | null
          skill_level?: string | null
          specialties?: string[] | null
          tier?: Database["public"]["Enums"]["creative_tier"] | null
          total_bookings?: number | null
        }
        Update: {
          area?: string | null
          availability_test_days_from_now?: number | null
          average_rating?: number | null
          bio?: string | null
          business_id?: string | null
          city?: string | null
          deposit_fixed_amount?: number | null
          deposit_percentage?: number | null
          deposit_type?: string | null
          display_name?: string | null
          id?: string | null
          is_accepting_referrals?: boolean | null
          is_active?: boolean | null
          profile_image_url?: string | null
          referral_discount_type?:
            | Database["public"]["Enums"]["discount_type"]
            | null
          referral_discount_value?: number | null
          require_booking_deposit?: boolean | null
          simulate_fully_booked?: boolean | null
          skill_level?: string | null
          specialties?: string[] | null
          tier?: Database["public"]["Enums"]["creative_tier"] | null
          total_bookings?: number | null
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
    }
    Functions: {
      assign_front_desk_role: {
        Args: { _admin_user_id: string; _business_id: string; _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_front_desk_for_business: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_solo_professional: { Args: { _user_id: string }; Returns: boolean }
      link_user_to_staff: {
        Args: { _staff_id: string; _user_id: string }
        Returns: undefined
      }
      manually_upgrade_to_pro: {
        Args: { _admin_user_id: string; _staff_id: string }
        Returns: undefined
      }
      update_staff_rating: { Args: { staff_uuid: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "staff" | "user" | "front_desk"
      booking_type_enum: "direct" | "cover" | "referral_network"
      business_type: "multi_staff_salon" | "solo_professional"
      commission_type: "finders_fee" | "revenue_share"
      creative_tier: "standard" | "founder" | "pro"
      discount_type: "percentage" | "fixed_amount"
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
      app_role: ["admin", "staff", "user", "front_desk"],
      booking_type_enum: ["direct", "cover", "referral_network"],
      business_type: ["multi_staff_salon", "solo_professional"],
      commission_type: ["finders_fee", "revenue_share"],
      creative_tier: ["standard", "founder", "pro"],
      discount_type: ["percentage", "fixed_amount"],
    },
  },
} as const
