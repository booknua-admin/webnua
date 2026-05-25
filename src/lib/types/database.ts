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
      agency_policy: {
        Row: {
          policy_key: Database["public"]["Enums"]["policy_key"]
          updated_at: string
          value: Json
        }
        Insert: {
          policy_key: Database["public"]["Enums"]["policy_key"]
          updated_at?: string
          value: Json
        }
        Update: {
          policy_key?: Database["public"]["Enums"]["policy_key"]
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          client_id: string
          event_type: Database["public"]["Enums"]["analytics_event_type"]
          id: string
          ingested_at: string
          occurred_at: string
          page_ref: string
          payload: Json
          session_id: string
          surface_id: string
          surface_kind: string
          visitor_id: string
        }
        Insert: {
          client_id: string
          event_type: Database["public"]["Enums"]["analytics_event_type"]
          id?: string
          ingested_at?: string
          occurred_at: string
          page_ref: string
          payload?: Json
          session_id: string
          surface_id: string
          surface_kind: string
          visitor_id: string
        }
        Update: {
          client_id?: string
          event_type?: Database["public"]["Enums"]["analytics_event_type"]
          id?: string
          ingested_at?: string
          occurred_at?: string
          page_ref?: string
          payload?: Json
          session_id?: string
          surface_id?: string
          surface_kind?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_funnel_daily: {
        Row: {
          client_id: string
          day: string
          element_label: string
          event_count: number
          page_ref: string
          stage: string
          surface_id: string
          surface_kind: string
          unique_visitors: number
        }
        Insert: {
          client_id: string
          day: string
          element_label?: string
          event_count?: number
          page_ref?: string
          stage: string
          surface_id: string
          surface_kind: string
          unique_visitors?: number
        }
        Update: {
          client_id?: string
          day?: string
          element_label?: string
          event_count?: number
          page_ref?: string
          stage?: string
          surface_id?: string
          surface_kind?: string
          unique_visitors?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_funnel_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_page_daily: {
        Row: {
          avg_seconds: number | null
          client_id: string
          cls_p75: number | null
          day: string
          inp_p75: number | null
          lcp_p75: number | null
          page_ref: string
          surface_id: string
          unique_visitors: number
          visits: number
        }
        Insert: {
          avg_seconds?: number | null
          client_id: string
          cls_p75?: number | null
          day: string
          inp_p75?: number | null
          lcp_p75?: number | null
          page_ref: string
          surface_id: string
          unique_visitors?: number
          visits?: number
        }
        Update: {
          avg_seconds?: number | null
          client_id?: string
          cls_p75?: number | null
          day?: string
          inp_p75?: number | null
          lcp_p75?: number | null
          page_ref?: string
          surface_id?: string
          unique_visitors?: number
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_page_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_actions: {
        Row: {
          action_config: Json
          action_type: Database["public"]["Enums"]["automation_action_type"]
          automation_id: string
          created_at: string
          id: string
          pauses_on_human_activity: boolean
          position: number
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: Database["public"]["Enums"]["automation_action_type"]
          automation_id: string
          created_at?: string
          id?: string
          pauses_on_human_activity: boolean
          position: number
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: Database["public"]["Enums"]["automation_action_type"]
          automation_id?: string
          created_at?: string
          id?: string
          pauses_on_human_activity?: boolean
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          action_sequence: string[]
          automation_id: string
          client_id: string
          completed_at: string | null
          created_at: string
          current_action_position: number
          error_message: string | null
          id: string
          last_automation_message_at: string | null
          lead_id: string | null
          paused_at: string | null
          paused_reason:
            | Database["public"]["Enums"]["automation_pause_reason"]
            | null
          resumed_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["automation_run_status"]
          trigger_event: Json
          updated_at: string
        }
        Insert: {
          action_sequence?: string[]
          automation_id: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          current_action_position?: number
          error_message?: string | null
          id?: string
          last_automation_message_at?: string | null
          lead_id?: string | null
          paused_at?: string | null
          paused_reason?:
            | Database["public"]["Enums"]["automation_pause_reason"]
            | null
          resumed_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["automation_run_status"]
          trigger_event?: Json
          updated_at?: string
        }
        Update: {
          action_sequence?: string[]
          automation_id?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          current_action_position?: number
          error_message?: string | null
          id?: string
          last_automation_message_at?: string | null
          lead_id?: string | null
          paused_at?: string | null
          paused_reason?:
            | Database["public"]["Enums"]["automation_pause_reason"]
            | null
          resumed_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["automation_run_status"]
          trigger_event?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_suppression_log: {
        Row: {
          action_id: string
          automation_id: string
          automation_run_id: string
          channel: string | null
          client_id: string
          context: Json
          deferred_until: string | null
          id: string
          lead_id: string | null
          reason: Database["public"]["Enums"]["automation_suppression_reason"]
          suppressed_at: string
        }
        Insert: {
          action_id: string
          automation_id: string
          automation_run_id: string
          channel?: string | null
          client_id: string
          context?: Json
          deferred_until?: string | null
          id?: string
          lead_id?: string | null
          reason: Database["public"]["Enums"]["automation_suppression_reason"]
          suppressed_at?: string
        }
        Update: {
          action_id?: string
          automation_id?: string
          automation_run_id?: string
          channel?: string | null
          client_id?: string
          context?: Json
          deferred_until?: string | null
          id?: string
          lead_id?: string | null
          reason?: Database["public"]["Enums"]["automation_suppression_reason"]
          suppressed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_suppression_log_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "automation_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_suppression_log_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_suppression_log_automation_run_id_fkey"
            columns: ["automation_run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_suppression_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_suppression_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          automation_key: string
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          is_enabled: boolean
          last_edited_by: string | null
          name: string
          trigger_config: Json
          trigger_filters: Json
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at: string
        }
        Insert: {
          automation_key: string
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          last_edited_by?: string | null
          name: string
          trigger_config?: Json
          trigger_filters?: Json
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
        }
        Update: {
          automation_key?: string
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          last_edited_by?: string | null
          name?: string
          trigger_config?: Json
          trigger_filters?: Json
          trigger_type?: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          address: string | null
          assigned_operator_id: string | null
          client_id: string
          created_at: string
          created_by: string
          customer_id: string
          customer_name_snapshot: string
          customer_phone_snapshot: string | null
          ends_at: string
          id: string
          lead_id: string | null
          notes: string | null
          price: number | null
          recurring_schedule_id: string | null
          service_type: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_operator_id?: string | null
          client_id: string
          created_at?: string
          created_by: string
          customer_id: string
          customer_name_snapshot: string
          customer_phone_snapshot?: string | null
          ends_at: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          price?: number | null
          recurring_schedule_id?: string | null
          service_type: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_operator_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          customer_name_snapshot?: string
          customer_phone_snapshot?: string | null
          ends_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          price?: number | null
          recurring_schedule_id?: string | null
          service_type?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_recurring_schedule_id_fkey"
            columns: ["recurring_schedule_id"]
            isOneToOne: false
            referencedRelation: "recurring_booking_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          accent_color: string
          audience_line: string
          background_color: string | null
          body_color: string | null
          body_font: string | null
          brand_colors: string[]
          client_id: string
          derived_palette: Json | null
          design_bundle_id: string | null
          favicon_url: string | null
          heading_color: string | null
          heading_font: string | null
          industry_category: string
          logo_url: string | null
          offer: Json | null
          tagline: string | null
          top_jobs_to_be_booked: string[]
          updated_at: string
          voice_formality: number
          voice_technicality: number
          voice_urgency: number
        }
        Insert: {
          accent_color: string
          audience_line: string
          background_color?: string | null
          body_color?: string | null
          body_font?: string | null
          brand_colors?: string[]
          client_id: string
          derived_palette?: Json | null
          design_bundle_id?: string | null
          favicon_url?: string | null
          heading_color?: string | null
          heading_font?: string | null
          industry_category: string
          logo_url?: string | null
          offer?: Json | null
          tagline?: string | null
          top_jobs_to_be_booked?: string[]
          updated_at?: string
          voice_formality: number
          voice_technicality: number
          voice_urgency: number
        }
        Update: {
          accent_color?: string
          audience_line?: string
          background_color?: string | null
          body_color?: string | null
          body_font?: string | null
          brand_colors?: string[]
          client_id?: string
          derived_palette?: Json | null
          design_bundle_id?: string | null
          favicon_url?: string | null
          heading_color?: string | null
          heading_font?: string | null
          industry_category?: string
          logo_url?: string | null
          offer?: Json | null
          tagline?: string | null
          top_jobs_to_be_booked?: string[]
          updated_at?: string
          voice_formality?: number
          voice_technicality?: number
          voice_urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "brands_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_activity_events: {
        Row: {
          actor_user_id: string | null
          campaign_id: string
          category: Database["public"]["Enums"]["campaign_activity_category"]
          created_at: string
          id: string
          occurred_at: string
          payload: Json
        }
        Insert: {
          actor_user_id?: string | null
          campaign_id: string
          category: Database["public"]["Enums"]["campaign_activity_category"]
          created_at?: string
          id?: string
          occurred_at: string
          payload?: Json
        }
        Update: {
          actor_user_id?: string | null
          campaign_id?: string
          category?: Database["public"]["Enums"]["campaign_activity_category"]
          created_at?: string
          id?: string
          occurred_at?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_activity_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_activity_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget: number | null
          client_id: string
          created_at: string
          ends_at: string | null
          external_ref: string | null
          id: string
          name: string
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client_id: string
          created_at?: string
          ends_at?: string | null
          external_ref?: string | null
          id?: string
          name: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client_id?: string
          created_at?: string
          ends_at?: string | null
          external_ref?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_grants: {
        Row: {
          capabilities: Database["public"]["Enums"]["capability"][]
          created_at: string
          id: string
          updated_at: string
          user_id: string
          website_id: string | null
        }
        Insert: {
          capabilities: Database["public"]["Enums"]["capability"][]
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          website_id?: string | null
        }
        Update: {
          capabilities?: Database["public"]["Enums"]["capability"][]
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_grants_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_custom_domains: {
        Row: {
          added_at: string
          added_by: string | null
          client_id: string
          dns_records_required: Json
          domain: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          last_error: string | null
          removed_at: string | null
          status: Database["public"]["Enums"]["client_custom_domain_status"]
          vercel_domain_name: string | null
          verification_failed_reason: string | null
          verified_at: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          client_id: string
          dns_records_required?: Json
          domain: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          removed_at?: string | null
          status?: Database["public"]["Enums"]["client_custom_domain_status"]
          vercel_domain_name?: string | null
          verification_failed_reason?: string | null
          verified_at?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          client_id?: string
          dns_records_required?: Json
          domain?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          removed_at?: string | null
          status?: Database["public"]["Enums"]["client_custom_domain_status"]
          vercel_domain_name?: string | null
          verification_failed_reason?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_custom_domains_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_custom_domains_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_email_senders: {
        Row: {
          client_id: string
          created_at: string
          custom_domain: string | null
          display_name: string
          id: string
          slug: string
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string
          custom_domain?: string | null
          display_name: string
          id?: string
          slug: string
          status?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          custom_domain?: string | null
          display_name?: string
          id?: string
          slug?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_email_senders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_gbp_locations: {
        Row: {
          address: string | null
          client_id: string
          created_at: string
          current_rating: number | null
          gbp_account_id: string
          gbp_location_id: string
          id: string
          last_synced_at: string | null
          location_title: string
          phone: string | null
          review_count: number
          review_link: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          client_id: string
          created_at?: string
          current_rating?: number | null
          gbp_account_id: string
          gbp_location_id: string
          id?: string
          last_synced_at?: string | null
          location_title?: string
          phone?: string | null
          review_count?: number
          review_link?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          client_id?: string
          created_at?: string
          current_rating?: number | null
          gbp_account_id?: string
          gbp_location_id?: string
          id?: string
          last_synced_at?: string | null
          location_title?: string
          phone?: string | null
          review_count?: number
          review_link?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_gbp_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_meta_ad_accounts: {
        Row: {
          account_status: number | null
          ad_account_name: string | null
          amount_spent_cents: number | null
          balance_cents: number | null
          client_id: string
          created_at: string
          currency: string | null
          customer_agreed_at: string | null
          customer_agreed_by_email: string | null
          id: string
          last_synced_at: string | null
          meta_ad_account_id: string
          meta_business_id: string | null
          meta_user_id: string | null
          timezone_name: string | null
          updated_at: string
        }
        Insert: {
          account_status?: number | null
          ad_account_name?: string | null
          amount_spent_cents?: number | null
          balance_cents?: number | null
          client_id: string
          created_at?: string
          currency?: string | null
          customer_agreed_at?: string | null
          customer_agreed_by_email?: string | null
          id?: string
          last_synced_at?: string | null
          meta_ad_account_id: string
          meta_business_id?: string | null
          meta_user_id?: string | null
          timezone_name?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: number | null
          ad_account_name?: string | null
          amount_spent_cents?: number | null
          balance_cents?: number | null
          client_id?: string
          created_at?: string
          currency?: string | null
          customer_agreed_at?: string | null
          customer_agreed_by_email?: string | null
          id?: string
          last_synced_at?: string | null
          meta_ad_account_id?: string
          meta_business_id?: string | null
          meta_user_id?: string | null
          timezone_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_meta_ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sms_senders: {
        Row: {
          client_id: string
          id: string
          notes: string | null
          registered_at: string
          sender_id: string
          status: string
          twilio_registration_sid: string | null
        }
        Insert: {
          client_id: string
          id?: string
          notes?: string | null
          registered_at?: string
          sender_id: string
          status?: string
          twilio_registration_sid?: string | null
        }
        Update: {
          client_id?: string
          id?: string
          notes?: string | null
          registered_at?: string
          sender_id?: string
          status?: string
          twilio_registration_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sms_senders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stripe_customers: {
        Row: {
          cancel_at_period_end: boolean
          client_id: string
          created_at: string
          current_period_end: string | null
          id: string
          last_payment_at: string | null
          last_payment_status: string | null
          past_due_since: string | null
          status: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          client_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_at?: string | null
          last_payment_status?: string | null
          past_due_since?: string | null
          status?: string
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          client_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_payment_at?: string | null
          last_payment_status?: string | null
          past_due_since?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_stripe_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_user_invites: {
        Row: {
          client_id: string
          consumed_at: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_at: string
          invited_by: string
          magic_link: string
          personal_note: string | null
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          client_id: string
          consumed_at?: string | null
          email: string
          expires_at: string
          full_name?: string
          id?: string
          invited_at?: string
          invited_by: string
          magic_link: string
          personal_note?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Update: {
          client_id?: string
          consumed_at?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_at?: string
          invited_by?: string
          magic_link?: string
          personal_note?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_user_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_user_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cancelled_at: string | null
          conversation_state: Json | null
          created_at: string
          data_deletion_scheduled_at: string | null
          hard_delete_warning_sent_at: string | null
          id: string
          industry: string
          lifecycle_status: Database["public"]["Enums"]["client_lifecycle"]
          name: string
          onboarded_by: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          quiet_hours_timezone: string
          re_engagement_sent_at: string | null
          review_requested_at: string | null
          service_area: string | null
          slug: string
          tracking_consent_mode: string
          updated_at: string
          wizard_completed_at: string | null
          wizard_state: Json | null
        }
        Insert: {
          cancelled_at?: string | null
          conversation_state?: Json | null
          created_at?: string
          data_deletion_scheduled_at?: string | null
          hard_delete_warning_sent_at?: string | null
          id?: string
          industry: string
          lifecycle_status?: Database["public"]["Enums"]["client_lifecycle"]
          name: string
          onboarded_by?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiet_hours_timezone?: string
          re_engagement_sent_at?: string | null
          review_requested_at?: string | null
          service_area?: string | null
          slug: string
          tracking_consent_mode?: string
          updated_at?: string
          wizard_completed_at?: string | null
          wizard_state?: Json | null
        }
        Update: {
          cancelled_at?: string | null
          conversation_state?: Json | null
          created_at?: string
          data_deletion_scheduled_at?: string | null
          hard_delete_warning_sent_at?: string | null
          id?: string
          industry?: string
          lifecycle_status?: Database["public"]["Enums"]["client_lifecycle"]
          name?: string
          onboarded_by?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiet_hours_timezone?: string
          re_engagement_sent_at?: string | null
          review_requested_at?: string | null
          service_area?: string | null
          slug?: string
          tracking_consent_mode?: string
          updated_at?: string
          wizard_completed_at?: string | null
          wizard_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_onboarded_by_fkey"
            columns: ["onboarded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_drafts: {
        Row: {
          funnel_id: string | null
          id: string
          page_key: string | null
          saved_at: string
          scope_kind: Database["public"]["Enums"]["draft_scope_kind"]
          sections: Json
          updated_by: string
          website_id: string | null
        }
        Insert: {
          funnel_id?: string | null
          id?: string
          page_key?: string | null
          saved_at: string
          scope_kind: Database["public"]["Enums"]["draft_scope_kind"]
          sections: Json
          updated_by: string
          website_id?: string | null
        }
        Update: {
          funnel_id?: string | null
          id?: string
          page_key?: string | null
          saved_at?: string
          scope_kind?: Database["public"]["Enums"]["draft_scope_kind"]
          sections?: Json
          updated_by?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_drafts_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          client_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          suburb: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          attachments: Json
          body_html: string
          body_text: string
          client_id: string
          correlation_id: string | null
          direction: string
          id: string
          in_reply_to_message_id: string | null
          is_auto_responder: boolean
          occurred_at: string
          recipient_address: string
          related_lead_id: string | null
          reply_to_address: string | null
          resend_message_id: string | null
          sender_address: string
          sent_by: string | null
          status: string
          subject: string
          thread_token: string | null
        }
        Insert: {
          attachments?: Json
          body_html?: string
          body_text?: string
          client_id: string
          correlation_id?: string | null
          direction: string
          id?: string
          in_reply_to_message_id?: string | null
          is_auto_responder?: boolean
          occurred_at?: string
          recipient_address: string
          related_lead_id?: string | null
          reply_to_address?: string | null
          resend_message_id?: string | null
          sender_address: string
          sent_by?: string | null
          status?: string
          subject?: string
          thread_token?: string | null
        }
        Update: {
          attachments?: Json
          body_html?: string
          body_text?: string
          client_id?: string
          correlation_id?: string | null
          direction?: string
          id?: string
          in_reply_to_message_id?: string | null
          is_auto_responder?: boolean
          occurred_at?: string
          recipient_address?: string
          related_lead_id?: string | null
          reply_to_address?: string | null
          resend_message_id?: string | null
          sender_address?: string
          sent_by?: string | null
          status?: string
          subject?: string
          thread_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
        }
        Relationships: []
      }
      force_publish_audit_log: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          new_version_id: string
          reason: string
          website_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          id?: string
          new_version_id: string
          reason: string
          website_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          new_version_id?: string
          reason?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "force_publish_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "force_publish_audit_log_new_version_id_fkey"
            columns: ["new_version_id"]
            isOneToOne: false
            referencedRelation: "website_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "force_publish_audit_log_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_approval_submissions: {
        Row: {
          diff: Json
          funnel_id: string
          id: string
          note: string | null
          pending_funnel_version_id: string
          rejection_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          submitted_at: string
          submitter_id: string
        }
        Insert: {
          diff: Json
          funnel_id: string
          id?: string
          note?: string | null
          pending_funnel_version_id: string
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          submitter_id: string
        }
        Update: {
          diff?: Json
          funnel_id?: string
          id?: string
          note?: string | null
          pending_funnel_version_id?: string
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          submitter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_approval_submissions_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_approval_submissions_pending_funnel_version_id_fkey"
            columns: ["pending_funnel_version_id"]
            isOneToOne: false
            referencedRelation: "funnel_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_approval_submissions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_approval_submissions_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_versions: {
        Row: {
          created_at: string
          created_by: string
          funnel_id: string
          id: string
          notes: string | null
          parent_version_id: string | null
          published_at: string | null
          published_by: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["version_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          funnel_id: string
          id?: string
          notes?: string | null
          parent_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["version_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          funnel_id?: string
          id?: string
          notes?: string | null
          parent_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["version_status"]
        }
        Relationships: [
          {
            foreignKeyName: "funnel_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_versions_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "funnel_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          client_id: string
          created_at: string
          domain_aliases: string[]
          domain_primary: string
          domain_ssl_status: Database["public"]["Enums"]["ssl_status"]
          draft_version_id: string | null
          funnel_customer_pain: string | null
          funnel_guarantee: string | null
          funnel_offer: Json | null
          funnel_service: string | null
          funnel_testimonials: Json
          id: string
          name: string
          published_version_id: string | null
          slug: string
          tracking_key: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          domain_aliases?: string[]
          domain_primary: string
          domain_ssl_status?: Database["public"]["Enums"]["ssl_status"]
          draft_version_id?: string | null
          funnel_customer_pain?: string | null
          funnel_guarantee?: string | null
          funnel_offer?: Json | null
          funnel_service?: string | null
          funnel_testimonials?: Json
          id?: string
          name: string
          published_version_id?: string | null
          slug: string
          tracking_key?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          domain_aliases?: string[]
          domain_primary?: string
          domain_ssl_status?: Database["public"]["Enums"]["ssl_status"]
          draft_version_id?: string | null
          funnel_customer_pain?: string | null
          funnel_guarantee?: string | null
          funnel_offer?: Json | null
          funnel_service?: string | null
          funnel_testimonials?: Json
          id?: string
          name?: string
          published_version_id?: string | null
          slug?: string
          tracking_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_draft_version_id_fkey"
            columns: ["draft_version_id"]
            isOneToOne: false
            referencedRelation: "funnel_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_published_version_id_fkey"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "funnel_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_review_requests: {
        Row: {
          booking_id: string | null
          channel: string
          clicked_at: string | null
          client_id: string
          error_message: string | null
          id: string
          lead_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          resulted_in_review_id: string | null
          review_link: string
          sent_at: string
          status: string
        }
        Insert: {
          booking_id?: string | null
          channel: string
          clicked_at?: string | null
          client_id: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          resulted_in_review_id?: string | null
          review_link: string
          sent_at?: string
          status?: string
        }
        Update: {
          booking_id?: string | null
          channel?: string
          clicked_at?: string | null
          client_id?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          resulted_in_review_id?: string | null
          review_link?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gbp_review_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gbp_review_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gbp_review_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gbp_review_requests_resulted_in_review_id_fkey"
            columns: ["resulted_in_review_id"]
            isOneToOne: false
            referencedRelation: "gbp_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      gbp_reviews: {
        Row: {
          client_id: string
          comment: string | null
          created_at_google: string
          deleted_at_google: string | null
          gbp_review_id: string
          id: string
          is_new_since_last_view: boolean
          rating: number
          reply_created_at: string | null
          reply_text: string | null
          reviewer_name: string | null
          reviewer_profile_photo_url: string | null
          synced_at: string
          updated_at_google: string | null
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at_google: string
          deleted_at_google?: string | null
          gbp_review_id: string
          id?: string
          is_new_since_last_view?: boolean
          rating: number
          reply_created_at?: string | null
          reply_text?: string | null
          reviewer_name?: string | null
          reviewer_profile_photo_url?: string | null
          synced_at?: string
          updated_at_google?: string | null
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at_google?: string
          deleted_at_google?: string | null
          gbp_review_id?: string
          id?: string
          is_new_since_last_view?: boolean
          rating?: number
          reply_created_at?: string | null
          reply_text?: string | null
          reviewer_name?: string | null
          reviewer_profile_photo_url?: string | null
          synced_at?: string
          updated_at_google?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gbp_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_log: {
        Row: {
          client_id: string
          created_at: string
          field_name: string
          generation_id: string
          id: string
          model_value: string | null
          page_id: string | null
          reason: Database["public"]["Enums"]["generation_fallback_reason"]
          section_type: Database["public"]["Enums"]["section_type"]
        }
        Insert: {
          client_id: string
          created_at?: string
          field_name: string
          generation_id: string
          id?: string
          model_value?: string | null
          page_id?: string | null
          reason: Database["public"]["Enums"]["generation_fallback_reason"]
          section_type: Database["public"]["Enums"]["section_type"]
        }
        Update: {
          client_id?: string
          created_at?: string
          field_name?: string
          generation_id?: string
          id?: string
          model_value?: string | null
          page_id?: string | null
          reason?: Database["public"]["Enums"]["generation_fallback_reason"]
          section_type?: Database["public"]["Enums"]["section_type"]
        }
        Relationships: [
          {
            foreignKeyName: "generation_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_call_log: {
        Row: {
          client_id: string | null
          correlation_id: string | null
          direction: string
          error_class: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          occurred_at: string
          operation: string
          provider: string
          request_shape: Json | null
          response_shape: Json | null
          response_status: number | null
        }
        Insert: {
          client_id?: string | null
          correlation_id?: string | null
          direction?: string
          error_class?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          occurred_at?: string
          operation: string
          provider: string
          request_shape?: Json | null
          response_shape?: Json | null
          response_status?: number | null
        }
        Update: {
          client_id?: string | null
          correlation_id?: string | null
          direction?: string
          error_class?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          occurred_at?: string
          operation?: string
          provider?: string
          request_shape?: Json | null
          response_shape?: Json | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_call_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          access_token_cached: string | null
          access_token_expires_at: string | null
          client_id: string
          connected_at: string
          id: string
          last_error: string | null
          last_failure_notified_at: string | null
          last_refreshed_at: string | null
          last_used_at: string | null
          provider: string
          provider_account_id: string
          scopes: string[]
          status: string
          token_model: string
          token_secret_id: string | null
        }
        Insert: {
          access_token_cached?: string | null
          access_token_expires_at?: string | null
          client_id: string
          connected_at?: string
          id?: string
          last_error?: string | null
          last_failure_notified_at?: string | null
          last_refreshed_at?: string | null
          last_used_at?: string | null
          provider: string
          provider_account_id: string
          scopes?: string[]
          status?: string
          token_model: string
          token_secret_id?: string | null
        }
        Update: {
          access_token_cached?: string | null
          access_token_expires_at?: string | null
          client_id?: string
          connected_at?: string
          id?: string
          last_error?: string | null
          last_failure_notified_at?: string | null
          last_refreshed_at?: string | null
          last_used_at?: string | null
          provider?: string
          provider_account_id?: string
          scopes?: string[]
          status?: string
          token_model?: string
          token_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_jobs: {
        Row: {
          attempts: number
          client_id: string | null
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          error_class: string | null
          error_message: string | null
          id: string
          job_type: string
          max_attempts: number
          payload: Json
          provider: string | null
          result: Json | null
          run_after: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          client_id?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          error_class?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          max_attempts?: number
          payload?: Json
          provider?: string | null
          result?: Json | null
          run_after?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          client_id?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          error_class?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          payload?: Json
          provider?: string | null
          result?: Json | null
          run_after?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      job_completions: {
        Row: {
          amount_charged: number
          booking_id: string
          completed_at: string
          completed_by: string
          id: string
          materials_cost: number | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          review_requested: boolean
        }
        Insert: {
          amount_charged: number
          booking_id: string
          completed_at?: string
          completed_by: string
          id?: string
          materials_cost?: number | null
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          review_requested?: boolean
        }
        Update: {
          amount_charged?: number
          booking_id?: string
          completed_at?: string
          completed_by?: string
          id?: string
          materials_cost?: number | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          review_requested?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "job_completions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          actor_user_id: string | null
          automation_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["lead_event_kind"]
          lead_id: string
          occurred_at: string
          payload: Json
          scheduled_for: string | null
        }
        Insert: {
          actor_user_id?: string | null
          automation_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["lead_event_kind"]
          lead_id: string
          occurred_at: string
          payload?: Json
          scheduled_for?: string | null
        }
        Update: {
          actor_user_id?: string | null
          automation_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["lead_event_kind"]
          lead_id?: string
          occurred_at?: string
          payload?: Json
          scheduled_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reads: {
        Row: {
          lead_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          lead_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          lead_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_reads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_operator_id: string | null
          automation_state: Database["public"]["Enums"]["lead_automation_state"]
          client_id: string
          created_at: string
          customer_id: string | null
          customer_name_snapshot: string
          customer_phone_snapshot: string | null
          followup_dismissed_at: string | null
          followup_nudge_count: number
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          needs_followup_at: string | null
          notification_pending_at: string | null
          source: string | null
          source_funnel_id: string | null
          source_kind: string
          status: Database["public"]["Enums"]["lead_status"]
          submission_id: string | null
          taken_over_at: string | null
          taken_over_by: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["lead_urgency"]
        }
        Insert: {
          assigned_operator_id?: string | null
          automation_state?: Database["public"]["Enums"]["lead_automation_state"]
          client_id: string
          created_at?: string
          customer_id?: string | null
          customer_name_snapshot: string
          customer_phone_snapshot?: string | null
          followup_dismissed_at?: string | null
          followup_nudge_count?: number
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          needs_followup_at?: string | null
          notification_pending_at?: string | null
          source?: string | null
          source_funnel_id?: string | null
          source_kind?: string
          status?: Database["public"]["Enums"]["lead_status"]
          submission_id?: string | null
          taken_over_at?: string | null
          taken_over_by?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["lead_urgency"]
        }
        Update: {
          assigned_operator_id?: string | null
          automation_state?: Database["public"]["Enums"]["lead_automation_state"]
          client_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name_snapshot?: string
          customer_phone_snapshot?: string | null
          followup_dismissed_at?: string | null
          followup_nudge_count?: number
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          needs_followup_at?: string | null
          notification_pending_at?: string | null
          source?: string | null
          source_funnel_id?: string | null
          source_kind?: string
          status?: Database["public"]["Enums"]["lead_status"]
          submission_id?: string | null
          taken_over_at?: string | null
          taken_over_by?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["lead_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_funnel_id_fkey"
            columns: ["source_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_taken_over_by_fkey"
            columns: ["taken_over_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_insights: {
        Row: {
          clicks: number
          client_id: string
          cpl_cents: number | null
          ctr_bps: number | null
          date_recorded: string
          id: string
          impressions: number
          leads: number
          meta_campaign_id: string
          raw_payload: Json | null
          spend_cents: number
          synced_at: string
        }
        Insert: {
          clicks?: number
          client_id: string
          cpl_cents?: number | null
          ctr_bps?: number | null
          date_recorded: string
          id?: string
          impressions?: number
          leads?: number
          meta_campaign_id: string
          raw_payload?: Json | null
          spend_cents?: number
          synced_at?: string
        }
        Update: {
          clicks?: number
          client_id?: string
          cpl_cents?: number | null
          ctr_bps?: number | null
          date_recorded?: string
          id?: string
          impressions?: number
          leads?: number
          meta_campaign_id?: string
          raw_payload?: Json | null
          spend_cents?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_insights_meta_campaign_id_fkey"
            columns: ["meta_campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          campaign_id: string
          campaign_name: string
          client_id: string
          created_at: string
          created_via: Database["public"]["Enums"]["meta_campaign_created_via"]
          daily_budget_cents: number | null
          end_date: string | null
          id: string
          last_insights_synced_at: string | null
          last_synced_at: string | null
          lifetime_budget_cents: number | null
          meta_ad_id: string | null
          meta_ad_set_id: string | null
          meta_campaign_id: string
          meta_creative_id: string | null
          meta_lead_form_id: string | null
          objective: string
          start_date: string | null
          status: Database["public"]["Enums"]["meta_campaign_status"]
          template_slug: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          client_id: string
          created_at?: string
          created_via?: Database["public"]["Enums"]["meta_campaign_created_via"]
          daily_budget_cents?: number | null
          end_date?: string | null
          id?: string
          last_insights_synced_at?: string | null
          last_synced_at?: string | null
          lifetime_budget_cents?: number | null
          meta_ad_id?: string | null
          meta_ad_set_id?: string | null
          meta_campaign_id: string
          meta_creative_id?: string | null
          meta_lead_form_id?: string | null
          objective?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["meta_campaign_status"]
          template_slug?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          client_id?: string
          created_at?: string
          created_via?: Database["public"]["Enums"]["meta_campaign_created_via"]
          daily_budget_cents?: number | null
          end_date?: string | null
          id?: string
          last_insights_synced_at?: string | null
          last_synced_at?: string | null
          lifetime_budget_cents?: number | null
          meta_ad_id?: string | null
          meta_ad_set_id?: string | null
          meta_campaign_id?: string
          meta_creative_id?: string | null
          meta_lead_form_id?: string | null
          objective?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["meta_campaign_status"]
          template_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_campaigns_meta_lead_form_id_fkey"
            columns: ["meta_lead_form_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_forms: {
        Row: {
          archived_at: string | null
          client_id: string
          created_at: string
          fields: Json
          form_name: string
          id: string
          meta_form_id: string
          meta_page_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          created_at?: string
          fields?: Json
          form_name: string
          id?: string
          meta_form_id: string
          meta_page_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          created_at?: string
          fields?: Json
          form_name?: string
          id?: string
          meta_form_id?: string
          meta_page_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_forms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          client_id: string
          created_at: string
          digest_frequency: string
          id: string
          notify_on_new_lead: boolean
          notify_on_payment_failure: boolean
          notify_on_review_received: boolean
          operator_email: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          digest_frequency?: string
          id?: string
          notify_on_new_lead?: boolean
          notify_on_payment_failure?: boolean
          notify_on_review_received?: boolean
          operator_email: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          digest_frequency?: string
          id?: string
          notify_on_new_lead?: boolean
          notify_on_payment_failure?: boolean
          notify_on_review_received?: boolean
          operator_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          recipient_user_id: string
          source_entity_id: string | null
          source_entity_type: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          recipient_user_id: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          recipient_user_id?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_outbound: {
        Row: {
          client_id: string
          id: string
          recipient_email: string
          related_lead_id: string | null
          resend_message_id: string | null
          sent_at: string
          status: string
          template_name: string
        }
        Insert: {
          client_id: string
          id?: string
          recipient_email: string
          related_lead_id?: string | null
          resend_message_id?: string | null
          sent_at?: string
          status?: string
          template_name: string
        }
        Update: {
          client_id?: string
          id?: string
          recipient_email?: string
          related_lead_id?: string | null
          resend_message_id?: string | null
          sent_at?: string
          status?: string
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_outbound_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_outbound_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          client_id: string
          plan_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          client_id: string
          plan_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          client_id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_catalog: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          currency: string
          description: string
          id: string
          name: string
          policy: Json
          price: number
          updated_at: string
        }
        Insert: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          currency: string
          description?: string
          id?: string
          name: string
          policy?: Json
          price: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          currency?: string
          description?: string
          id?: string
          name?: string
          policy?: Json
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_email_templates: {
        Row: {
          body_html: string
          body_text: string
          created_at: string
          id: string
          last_edited_at: string
          last_edited_by: string | null
          subject: string
          template_key: string
        }
        Insert: {
          body_html: string
          body_text: string
          created_at?: string
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          subject: string
          template_key: string
        }
        Update: {
          body_html?: string
          body_text?: string
          created_at?: string
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          subject?: string
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_email_templates_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_overrides: {
        Row: {
          client_id: string
          policy_key: Database["public"]["Enums"]["policy_key"]
          updated_at: string
          value: Json
        }
        Insert: {
          client_id: string
          policy_key: Database["public"]["Enums"]["policy_key"]
          updated_at?: string
          value: Json
        }
        Update: {
          client_id?: string
          policy_key?: Database["public"]["Enums"]["policy_key"]
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "policy_overrides_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          action: string
          client_id: string | null
          id: string
          ip: unknown
          key: string
          occurred_at: string
          reason: string | null
          status: string
        }
        Insert: {
          action: string
          client_id?: string | null
          id?: string
          ip?: unknown
          key: string
          occurred_at?: string
          reason?: string | null
          status?: string
        }
        Update: {
          action?: string
          client_id?: string | null
          id?: string
          ip?: unknown
          key?: string
          occurred_at?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_hits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_booking_schedules: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          created_by: string
          customer_id: string
          customer_name_snapshot: string
          customer_phone_snapshot: string | null
          day_of_week: number | null
          duration_minutes: number
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          lead_id: string | null
          price: number | null
          service_type: string
          start_time: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          created_by: string
          customer_id: string
          customer_name_snapshot: string
          customer_phone_snapshot?: string | null
          day_of_week?: number | null
          duration_minutes: number
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          lead_id?: string | null
          price?: number | null
          service_type: string
          start_time: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          customer_name_snapshot?: string
          customer_phone_snapshot?: string | null
          day_of_week?: number | null
          duration_minutes?: number
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          lead_id?: string | null
          price?: number | null
          service_type?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_booking_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_booking_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_booking_schedules_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_booking_schedules_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          body: string
          client_id: string
          created_at: string
          customer_id: string | null
          external_id: string | null
          id: string
          job: string | null
          reviewed_at: string
          source: string
          stars: number
        }
        Insert: {
          author_name: string
          body: string
          client_id: string
          created_at?: string
          customer_id?: string | null
          external_id?: string | null
          id?: string
          job?: string | null
          reviewed_at: string
          source?: string
          stars: number
        }
        Update: {
          author_name?: string
          body?: string
          client_id?: string
          created_at?: string
          customer_id?: string | null
          external_id?: string | null
          id?: string
          job?: string | null
          reviewed_at?: string
          source?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_limit_changes: {
        Row: {
          changed_at: string
          changed_by: string
          client_id: string
          id: string
          new_limit: number | null
          previous_limit: number | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          client_id: string
          id?: string
          new_limit?: number | null
          previous_limit?: number | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          client_id?: string
          id?: string
          new_limit?: number | null
          previous_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seat_limit_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_limit_changes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_submissions: {
        Row: {
          ad_spend_max: number | null
          ad_spend_min: number | null
          base_leads_estimate: number | null
          brand_colors: string[]
          business_name: string | null
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          guaranteed_leads: number | null
          id: string
          ip_hash: string | null
          main_service: string | null
          meta: Json
          monthly_price: number
          service_area: string
          setup_fee: number
          setup_fee_waived: boolean
          signed_up_at: string | null
          status: Database["public"]["Enums"]["signup_submission_status"]
          trade: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          ad_spend_max?: number | null
          ad_spend_min?: number | null
          base_leads_estimate?: number | null
          brand_colors?: string[]
          business_name?: string | null
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          guaranteed_leads?: number | null
          id?: string
          ip_hash?: string | null
          main_service?: string | null
          meta?: Json
          monthly_price?: number
          service_area: string
          setup_fee?: number
          setup_fee_waived?: boolean
          signed_up_at?: string | null
          status?: Database["public"]["Enums"]["signup_submission_status"]
          trade: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          ad_spend_max?: number | null
          ad_spend_min?: number | null
          base_leads_estimate?: number | null
          brand_colors?: string[]
          business_name?: string | null
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          guaranteed_leads?: number | null
          id?: string
          ip_hash?: string | null
          main_service?: string | null
          meta?: Json
          monthly_price?: number
          service_area?: string
          setup_fee?: number
          setup_fee_waived?: boolean
          signed_up_at?: string | null
          status?: Database["public"]["Enums"]["signup_submission_status"]
          trade?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          client_id: string
          cost_eur: number | null
          encoding: string
          error_code: string | null
          error_message: string | null
          id: string
          message_body: string
          recipient_phone: string
          related_lead_id: string | null
          segments_count: number
          sender_id: string
          sent_at: string
          status: string
          twilio_message_sid: string | null
        }
        Insert: {
          client_id: string
          cost_eur?: number | null
          encoding?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_body: string
          recipient_phone: string
          related_lead_id?: string | null
          segments_count?: number
          sender_id: string
          sent_at?: string
          status?: string
          twilio_message_sid?: string | null
        }
        Update: {
          client_id?: string
          cost_eur?: number | null
          encoding?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_body?: string
          recipient_phone?: string
          related_lead_id?: string | null
          segments_count?: number
          sender_id?: string
          sent_at?: string
          status?: string
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invite_clients: {
        Row: {
          client_id: string
          invite_id: string
        }
        Insert: {
          client_id: string
          invite_id: string
        }
        Update: {
          client_id?: string
          invite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invite_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invite_clients_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "team_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          consumed_at: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_at: string
          invited_by: string
          magic_link: string
          personal_note: string
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          consumed_at?: string | null
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_at?: string
          invited_by: string
          magic_link: string
          personal_note?: string
          role: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Update: {
          consumed_at?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_at?: string
          invited_by?: string
          magic_link?: string
          personal_note?: string
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          is_draft: boolean
          ticket_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          is_draft?: boolean
          ticket_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          is_draft?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_operator_id: string | null
          awaiting: Database["public"]["Enums"]["ticket_awaiting"] | null
          category: Database["public"]["Enums"]["ticket_category"]
          client_id: string
          context_field_key: string | null
          context_page_id: string | null
          context_section_id: string | null
          context_website_id: string | null
          created_at: string
          created_by: string
          id: string
          reference: string
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["ticket_urgency"]
        }
        Insert: {
          assigned_operator_id?: string | null
          awaiting?: Database["public"]["Enums"]["ticket_awaiting"] | null
          category: Database["public"]["Enums"]["ticket_category"]
          client_id: string
          context_field_key?: string | null
          context_page_id?: string | null
          context_section_id?: string | null
          context_website_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          reference: string
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["ticket_urgency"]
        }
        Update: {
          assigned_operator_id?: string | null
          awaiting?: Database["public"]["Enums"]["ticket_awaiting"] | null
          category?: Database["public"]["Enums"]["ticket_category"]
          client_id?: string
          context_field_key?: string | null
          context_page_id?: string | null
          context_section_id?: string | null
          context_website_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          reference?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["ticket_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_context_website_id_fkey"
            columns: ["context_website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_client_access: {
        Row: {
          client_id: string
          granted_at: string
          granted_by: string
          user_id: string
        }
        Insert: {
          client_id: string
          granted_at?: string
          granted_by: string
          user_id: string
        }
        Update: {
          client_id?: string
          granted_at?: string
          granted_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_client_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_client_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_initial: string | null
          client_id: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          team_role: Database["public"]["Enums"]["team_role"] | null
          updated_at: string
        }
        Insert: {
          avatar_initial?: string | null
          client_id?: string | null
          created_at?: string
          display_name: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          team_role?: Database["public"]["Enums"]["team_role"] | null
          updated_at?: string
        }
        Update: {
          avatar_initial?: string | null
          client_id?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          team_role?: Database["public"]["Enums"]["team_role"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      website_approval_submissions: {
        Row: {
          diff: Json
          id: string
          note: string | null
          pending_version_id: string
          rejection_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          submitted_at: string
          submitter_id: string
          website_id: string
        }
        Insert: {
          diff: Json
          id?: string
          note?: string | null
          pending_version_id: string
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          submitter_id: string
          website_id: string
        }
        Update: {
          diff?: Json
          id?: string
          note?: string | null
          pending_version_id?: string
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          submitter_id?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_approval_submissions_pending_version_id_fkey"
            columns: ["pending_version_id"]
            isOneToOne: false
            referencedRelation: "website_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_approval_submissions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_approval_submissions_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_approval_submissions_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      website_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          parent_version_id: string | null
          published_at: string | null
          published_by: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["version_status"]
          website_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          parent_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["version_status"]
          website_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          parent_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["version_status"]
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "website_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_versions_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          client_id: string
          created_at: string
          domain_aliases: string[]
          domain_primary: string
          domain_ssl_status: Database["public"]["Enums"]["ssl_status"]
          draft_version_id: string | null
          id: string
          name: string
          published_version_id: string | null
          tracking_key: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          domain_aliases?: string[]
          domain_primary: string
          domain_ssl_status?: Database["public"]["Enums"]["ssl_status"]
          draft_version_id?: string | null
          id?: string
          name: string
          published_version_id?: string | null
          tracking_key?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          domain_aliases?: string[]
          domain_primary?: string
          domain_ssl_status?: Database["public"]["Enums"]["ssl_status"]
          draft_version_id?: string | null
          id?: string
          name?: string
          published_version_id?: string | null
          tracking_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "websites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "websites_draft_version_id_fkey"
            columns: ["draft_version_id"]
            isOneToOne: false
            referencedRelation: "website_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "websites_published_version_id_fkey"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "website_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      webnua_vault_create_secret: {
        Args: { p_description?: string; p_secret: string }
        Returns: string
      }
      webnua_vault_delete_secret: { Args: { p_id: string }; Returns: undefined }
      webnua_vault_read_secret: { Args: { p_id: string }; Returns: string }
      webnua_vault_update_secret: {
        Args: { p_id: string; p_secret: string }
        Returns: undefined
      }
    }
    Enums: {
      analytics_event_type:
        | "page_view"
        | "scroll_depth"
        | "element_click"
        | "form_start"
        | "form_field"
        | "form_abandon"
        | "form_submit"
        | "web_vital"
        | "form_submit_error"
      approval_status: "pending" | "approved" | "rejected" | "recalled"
      automation_action_type:
        | "send_sms_to_lead"
        | "send_email_to_lead"
        | "send_operator_notification"
        | "wait_for_duration"
        | "update_lead_field"
        | "create_followup_task"
      automation_channel: "sms" | "email"
      automation_pause_reason:
        | "lead_replied"
        | "client_took_over"
        | "manually_cancelled"
      automation_run_status:
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "paused"
      automation_suppression_reason:
        | "frequency_cap_hourly"
        | "frequency_cap_daily"
        | "quiet_hours"
        | "priority_cancelled"
      automation_trigger_type:
        | "lead_created"
        | "job_completed"
        | "payment_failed"
        | "job_scheduled"
        | "job_status_changed"
        | "lead_inactive"
      billing_cycle: "monthly" | "yearly"
      booking_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      campaign_activity_category: "creative" | "audience" | "budget" | "tune"
      campaign_status: "active" | "paused" | "pending"
      capability:
        | "viewBuilder"
        | "editCopy"
        | "editMedia"
        | "editSEO"
        | "editLayout"
        | "editSections"
        | "editTheme"
        | "editPages"
        | "useAI"
        | "publish"
        | "approve"
        | "rollback"
        | "manageDomain"
        | "editForms"
      client_custom_domain_status:
        | "pending_dns"
        | "verifying"
        | "ssl_pending"
        | "live"
        | "failed"
        | "removed"
      client_lifecycle:
        | "onboarding"
        | "live"
        | "paused"
        | "churned"
        | "pending_verification"
        | "preview"
        | "banned"
        | "active"
        | "cancelled"
        | "deleted"
      delay_unit: "minutes" | "hours" | "days"
      draft_scope_kind: "page" | "header" | "footer" | "funnel_step"
      funnel_step_type: "landing" | "schedule" | "thanks" | "optin" | "upsell"
      generation_fallback_reason: "missing" | "invalid" | "variant-reassigned"
      invite_status: "pending" | "accepted" | "expired" | "revoked"
      lead_automation_state:
        | "automated"
        | "taken_over"
        | "completed"
        | "archived"
      lead_event_kind:
        | "sms_in"
        | "sms_out"
        | "email_in"
        | "email_out"
        | "form_submitted"
        | "status_changed"
        | "booking_created"
        | "automation_fired"
      lead_status: "new" | "contacted" | "booked" | "completed" | "lost"
      lead_urgency: "asap" | "today" | "soon" | "none"
      meta_campaign_created_via:
        | "webnua_month_1"
        | "webnua_ongoing"
        | "external"
      meta_campaign_status:
        | "active"
        | "paused"
        | "archived"
        | "in_review"
        | "with_issues"
      notification_kind: "lead" | "review" | "auto" | "booking" | "alert"
      page_type: "home" | "about" | "services" | "contact" | "generic"
      payment_method: "card" | "cash" | "invoice_7" | "invoice_14"
      policy_key:
        | "defaultClientCapabilities"
        | "integrationDefaults"
        | "defaultSeatLimit"
        | "brandDefaults"
        | "automationDefaults"
        | "pricingDefaults"
      recurrence_frequency: "weekly" | "fortnightly" | "monthly" | "custom"
      section_type:
        | "hero"
        | "offer"
        | "trust"
        | "services"
        | "reviews"
        | "faq"
        | "cta"
        | "schedulePicker"
        | "thanksConfirmation"
        | "header"
        | "footer"
        | "features"
        | "gallery"
        | "about"
        | "contact"
        | "form"
      signup_submission_status: "new" | "contacted" | "converted" | "dismissed"
      ssl_status: "pending" | "live" | "error"
      team_role: "owner" | "operator" | "junior"
      ticket_awaiting: "operator" | "client"
      ticket_category:
        | "website"
        | "website-approval"
        | "marketing"
        | "campaigns"
        | "reviews"
        | "billing"
        | "other"
      ticket_status: "open" | "in_progress" | "blocked" | "done"
      ticket_urgency: "rush" | "soon" | "none"
      user_role: "admin" | "client"
      version_status: "draft" | "pending_approval" | "published" | "archived"
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
      analytics_event_type: [
        "page_view",
        "scroll_depth",
        "element_click",
        "form_start",
        "form_field",
        "form_abandon",
        "form_submit",
        "web_vital",
        "form_submit_error",
      ],
      approval_status: ["pending", "approved", "rejected", "recalled"],
      automation_action_type: [
        "send_sms_to_lead",
        "send_email_to_lead",
        "send_operator_notification",
        "wait_for_duration",
        "update_lead_field",
        "create_followup_task",
      ],
      automation_channel: ["sms", "email"],
      automation_pause_reason: [
        "lead_replied",
        "client_took_over",
        "manually_cancelled",
      ],
      automation_run_status: [
        "running",
        "completed",
        "failed",
        "cancelled",
        "paused",
      ],
      automation_suppression_reason: [
        "frequency_cap_hourly",
        "frequency_cap_daily",
        "quiet_hours",
        "priority_cancelled",
      ],
      automation_trigger_type: [
        "lead_created",
        "job_completed",
        "payment_failed",
        "job_scheduled",
        "job_status_changed",
        "lead_inactive",
      ],
      billing_cycle: ["monthly", "yearly"],
      booking_status: ["scheduled", "in_progress", "completed", "cancelled"],
      campaign_activity_category: ["creative", "audience", "budget", "tune"],
      campaign_status: ["active", "paused", "pending"],
      capability: [
        "viewBuilder",
        "editCopy",
        "editMedia",
        "editSEO",
        "editLayout",
        "editSections",
        "editTheme",
        "editPages",
        "useAI",
        "publish",
        "approve",
        "rollback",
        "manageDomain",
        "editForms",
      ],
      client_custom_domain_status: [
        "pending_dns",
        "verifying",
        "ssl_pending",
        "live",
        "failed",
        "removed",
      ],
      client_lifecycle: [
        "onboarding",
        "live",
        "paused",
        "churned",
        "pending_verification",
        "preview",
        "banned",
        "active",
        "cancelled",
        "deleted",
      ],
      delay_unit: ["minutes", "hours", "days"],
      draft_scope_kind: ["page", "header", "footer", "funnel_step"],
      funnel_step_type: ["landing", "schedule", "thanks", "optin", "upsell"],
      generation_fallback_reason: ["missing", "invalid", "variant-reassigned"],
      invite_status: ["pending", "accepted", "expired", "revoked"],
      lead_automation_state: [
        "automated",
        "taken_over",
        "completed",
        "archived",
      ],
      lead_event_kind: [
        "sms_in",
        "sms_out",
        "email_in",
        "email_out",
        "form_submitted",
        "status_changed",
        "booking_created",
        "automation_fired",
      ],
      lead_status: ["new", "contacted", "booked", "completed", "lost"],
      lead_urgency: ["asap", "today", "soon", "none"],
      meta_campaign_created_via: [
        "webnua_month_1",
        "webnua_ongoing",
        "external",
      ],
      meta_campaign_status: [
        "active",
        "paused",
        "archived",
        "in_review",
        "with_issues",
      ],
      notification_kind: ["lead", "review", "auto", "booking", "alert"],
      page_type: ["home", "about", "services", "contact", "generic"],
      payment_method: ["card", "cash", "invoice_7", "invoice_14"],
      policy_key: [
        "defaultClientCapabilities",
        "integrationDefaults",
        "defaultSeatLimit",
        "brandDefaults",
        "automationDefaults",
        "pricingDefaults",
      ],
      recurrence_frequency: ["weekly", "fortnightly", "monthly", "custom"],
      section_type: [
        "hero",
        "offer",
        "trust",
        "services",
        "reviews",
        "faq",
        "cta",
        "schedulePicker",
        "thanksConfirmation",
        "header",
        "footer",
        "features",
        "gallery",
        "about",
        "contact",
        "form",
      ],
      signup_submission_status: ["new", "contacted", "converted", "dismissed"],
      ssl_status: ["pending", "live", "error"],
      team_role: ["owner", "operator", "junior"],
      ticket_awaiting: ["operator", "client"],
      ticket_category: [
        "website",
        "website-approval",
        "marketing",
        "campaigns",
        "reviews",
        "billing",
        "other",
      ],
      ticket_status: ["open", "in_progress", "blocked", "done"],
      ticket_urgency: ["rush", "soon", "none"],
      user_role: ["admin", "client"],
      version_status: ["draft", "pending_approval", "published", "archived"],
    },
  },
} as const
