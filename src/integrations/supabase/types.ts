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
      events: {
        Row: {
          category: string | null
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          fee_waived: boolean
          id: string
          is_stream: boolean
          latitude: number | null
          longitude: number | null
          lpp_config: Json
          lpp_enabled: boolean
          max_resale_percentage: number
          min_resale_percentage: number
          organizer_id: string
          poster_url: string | null
          resale_enabled: boolean
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          stream_url: string | null
          tagline: string | null
          ticket_design: Json
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          fee_waived?: boolean
          id?: string
          is_stream?: boolean
          latitude?: number | null
          longitude?: number | null
          lpp_config?: Json
          lpp_enabled?: boolean
          max_resale_percentage?: number
          min_resale_percentage?: number
          organizer_id: string
          poster_url?: string | null
          resale_enabled?: boolean
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          stream_url?: string | null
          tagline?: string | null
          ticket_design?: Json
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          fee_waived?: boolean
          id?: string
          is_stream?: boolean
          latitude?: number | null
          longitude?: number | null
          lpp_config?: Json
          lpp_enabled?: boolean
          max_resale_percentage?: number
          min_resale_percentage?: number
          organizer_id?: string
          poster_url?: string | null
          resale_enabled?: boolean
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          stream_url?: string | null
          tagline?: string | null
          ticket_design?: Json
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          event_id: string
          fee_waived: boolean
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          marketing_opt_in: boolean
          organizer_fee_kes: number
          payment_method: string
          payment_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_kes: number
          total_kes: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          fee_waived?: boolean
          guest_email: string
          guest_name: string
          guest_phone: string
          id?: string
          marketing_opt_in?: boolean
          organizer_fee_kes?: number
          payment_method?: string
          payment_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kes?: number
          total_kes?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          fee_waived?: boolean
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          marketing_opt_in?: boolean
          organizer_fee_kes?: number
          payment_method?: string
          payment_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kes?: number
          total_kes?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ticket_resale_listings_public"
            referencedColumns: ["event_id"]
          },
        ]
      }
      organizer_admin_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          expires_at: string
          id: string
          invited_email: string | null
          organizer_id: string
          revoked_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          expires_at: string
          id?: string
          invited_email?: string | null
          organizer_id: string
          revoked_at?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          expires_at?: string
          id?: string
          invited_email?: string | null
          organizer_id?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_admin_invites_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_profiles: {
        Row: {
          bio: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          events_published_count: number
          fee_locked_pct: number | null
          handle: string
          id: string
          logo_url: string | null
          marketing_opt_in: boolean
          mpesa_payout_phone: string | null
          org_name: string
          payout_method: string
          paystack_account_name: string | null
          paystack_account_number: string | null
          paystack_bank_code: string | null
          paystack_subaccount_code: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          events_published_count?: number
          fee_locked_pct?: number | null
          handle: string
          id?: string
          logo_url?: string | null
          marketing_opt_in?: boolean
          mpesa_payout_phone?: string | null
          org_name: string
          payout_method?: string
          paystack_account_name?: string | null
          paystack_account_number?: string | null
          paystack_bank_code?: string | null
          paystack_subaccount_code?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          events_published_count?: number
          fee_locked_pct?: number | null
          handle?: string
          id?: string
          logo_url?: string | null
          marketing_opt_in?: boolean
          mpesa_payout_phone?: string | null
          org_name?: string
          payout_method?: string
          paystack_account_name?: string | null
          paystack_account_number?: string | null
          paystack_bank_code?: string | null
          paystack_subaccount_code?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      organizer_team_members: {
        Row: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          organizer_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          organizer_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          organizer_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_team_members_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_installments: {
        Row: {
          amount_kes: number
          created_at: string
          due_at: string
          id: string
          kind: string
          paid_at: string | null
          payment_ref: string | null
          plan_id: string
          provider_receipt: string | null
          sequence: number
          status: string
          updated_at: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          due_at: string
          id?: string
          kind: string
          paid_at?: string | null
          payment_ref?: string | null
          plan_id: string
          provider_receipt?: string | null
          sequence: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          due_at?: string
          id?: string
          kind?: string
          paid_at?: string | null
          payment_ref?: string | null
          plan_id?: string
          provider_receipt?: string | null
          sequence?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_installments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          balance_kes: number
          buyer_fee_kes: number
          completed_at: string | null
          created_at: string
          deposit_kes: number
          deposit_pct: number
          event_id: string
          event_starts_at: string
          final_due_at: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          installments_count: number
          interval_days: number
          paid_kes: number
          plan_key: string
          plan_label: string
          quantity: number
          ref_no: string
          reserved_at: string | null
          status: string
          subtotal_kes: number
          ticket_holders: Json
          tier_id: string
          total_kes: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          balance_kes: number
          buyer_fee_kes?: number
          completed_at?: string | null
          created_at?: string
          deposit_kes: number
          deposit_pct: number
          event_id: string
          event_starts_at: string
          final_due_at: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id?: string
          installments_count: number
          interval_days: number
          paid_kes?: number
          plan_key: string
          plan_label: string
          quantity: number
          ref_no: string
          reserved_at?: string | null
          status?: string
          subtotal_kes: number
          ticket_holders?: Json
          tier_id: string
          total_kes: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          balance_kes?: number
          buyer_fee_kes?: number
          completed_at?: string | null
          created_at?: string
          deposit_kes?: number
          deposit_pct?: number
          event_id?: string
          event_starts_at?: string
          final_due_at?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          installments_count?: number
          interval_days?: number
          paid_kes?: number
          plan_key?: string
          plan_label?: string
          quantity?: number
          ref_no?: string
          reserved_at?: string | null
          status?: string
          subtotal_kes?: number
          ticket_holders?: Json
          tier_id?: string
          total_kes?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ticket_resale_listings_public"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "payment_plans_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_kes: number
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          order_id: string
          paystack_reference: string | null
          phone: string
          provider: string
          raw_callback: Json | null
          result_code: number | null
          result_desc: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_kes: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          order_id: string
          paystack_reference?: string | null
          phone: string
          provider?: string
          raw_callback?: Json | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          order_id?: string
          paystack_reference?: string | null
          phone?: string
          provider?: string
          raw_callback?: Json | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resale_transfers: {
        Row: {
          buyer_user_id: string
          completed_at: string
          created_at: string
          id: string
          listing_id: string
          payment_provider: string | null
          payment_ref: string | null
          previous_qr_token_hash: string
          sale_price_kes: number
          seller_user_id: string
          ticket_id: string
        }
        Insert: {
          buyer_user_id: string
          completed_at?: string
          created_at?: string
          id?: string
          listing_id: string
          payment_provider?: string | null
          payment_ref?: string | null
          previous_qr_token_hash: string
          sale_price_kes: number
          seller_user_id: string
          ticket_id: string
        }
        Update: {
          buyer_user_id?: string
          completed_at?: string
          created_at?: string
          id?: string
          listing_id?: string
          payment_provider?: string | null
          payment_ref?: string | null
          previous_qr_token_hash?: string
          sale_price_kes?: number
          seller_user_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resale_transfers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ticket_resale_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resale_transfers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ticket_resale_listings_public"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "resale_transfers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_resale_listings: {
        Row: {
          buyer_user_id: string | null
          cancelled_at: string | null
          created_at: string
          event_id: string
          id: string
          listed_at: string
          payment_expires_at: string | null
          payment_ref: string | null
          resale_price_kes: number
          seller_user_id: string
          sold_at: string | null
          status: Database["public"]["Enums"]["resale_listing_status"]
          ticket_id: string
          updated_at: string
        }
        Insert: {
          buyer_user_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          listed_at?: string
          payment_expires_at?: string | null
          payment_ref?: string | null
          resale_price_kes: number
          seller_user_id: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["resale_listing_status"]
          ticket_id: string
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          listed_at?: string
          payment_expires_at?: string | null
          payment_ref?: string | null
          resale_price_kes?: number
          seller_user_id?: string
          sold_at?: string | null
          status?: Database["public"]["Enums"]["resale_listing_status"]
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_resale_listings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_resale_listings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ticket_resale_listings_public"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "ticket_resale_listings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tiers: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          price_kes: number
          quantity: number
          sold: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          price_kes?: number
          quantity?: number
          sold?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          price_kes?: number
          quantity?: number
          sold?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ticket_resale_listings_public"
            referencedColumns: ["event_id"]
          },
        ]
      }
      tickets: {
        Row: {
          checked_in_at: string | null
          created_at: string
          current_owner_user_id: string | null
          event_id: string
          holder_email: string
          holder_name: string
          id: string
          order_id: string
          qr_token: string
          qr_token_version: number
          revoked_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          tier_id: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          current_owner_user_id?: string | null
          event_id: string
          holder_email: string
          holder_name: string
          id?: string
          order_id: string
          qr_token?: string
          qr_token_version?: number
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tier_id: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          current_owner_user_id?: string | null
          event_id?: string
          holder_email?: string
          holder_name?: string
          id?: string
          order_id?: string
          qr_token?: string
          qr_token_version?: number
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ticket_resale_listings_public"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      ticket_resale_listings_public: {
        Row: {
          event_city: string | null
          event_cover_image_url: string | null
          event_id: string | null
          event_poster_url: string | null
          event_slug: string | null
          event_starts_at: string | null
          event_title: string | null
          event_venue_name: string | null
          listed_at: string | null
          listing_id: string | null
          original_price_kes: number | null
          resale_price_kes: number | null
          status: Database["public"]["Enums"]["resale_listing_status"] | null
          tier_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_organizer_admin_invite: {
        Args: { _token: string }
        Returns: string
      }
      complete_resale_transfer: {
        Args: {
          _listing_id: string
          _new_qr_token: string
          _payment_provider: string
          _payment_ref: string
        }
        Returns: {
          buyer_user_id: string
          completed_at: string
          created_at: string
          id: string
          listing_id: string
          payment_provider: string | null
          payment_ref: string | null
          previous_qr_token_hash: string
          sale_price_kes: number
          seller_user_id: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "resale_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organizer_admin_invite: {
        Args: {
          _expires_in_hours?: number
          _invited_email?: string
          _organizer_id: string
        }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      expire_stale_resale_reservations: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initiate_resale_purchase: {
        Args: {
          _buyer_user_id: string
          _expires_minutes?: number
          _listing_id: string
        }
        Returns: {
          buyer_user_id: string | null
          cancelled_at: string | null
          created_at: string
          event_id: string
          id: string
          listed_at: string
          payment_expires_at: string | null
          payment_ref: string | null
          resale_price_kes: number
          seller_user_id: string
          sold_at: string | null
          status: Database["public"]["Enums"]["resale_listing_status"]
          ticket_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_resale_listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_organizer_team_member: {
        Args: { _organizer_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "organizer" | "attendee" | "super_admin"
      event_status: "draft" | "published" | "cancelled" | "completed"
      order_status: "pending" | "paid" | "failed" | "refunded"
      resale_listing_status:
        | "active"
        | "pending_payment"
        | "sold"
        | "cancelled"
        | "expired"
      ticket_status: "valid" | "used" | "refunded" | "cancelled"
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
      app_role: ["admin", "organizer", "attendee", "super_admin"],
      event_status: ["draft", "published", "cancelled", "completed"],
      order_status: ["pending", "paid", "failed", "refunded"],
      resale_listing_status: [
        "active",
        "pending_payment",
        "sold",
        "cancelled",
        "expired",
      ],
      ticket_status: ["valid", "used", "refunded", "cancelled"],
    },
  },
} as const
