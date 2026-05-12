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
      backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          id: string
          lease_id: string | null
          mime_type: string | null
          name: string
          owner_id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          lease_id?: string | null
          mime_type?: string | null
          name: string
          owner_id: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          lease_id?: string | null
          mime_type?: string | null
          name?: string
          owner_id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          email: string | null
          expires_at: string | null
          first_name: string | null
          last_name: string | null
          max_uses: number
          note: string | null
          property: string | null
          role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
          used_by: string | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          email?: string | null
          expires_at?: string | null
          first_name?: string | null
          last_name?: string | null
          max_uses?: number
          note?: string | null
          property?: string | null
          role: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          email?: string | null
          expires_at?: string | null
          first_name?: string | null
          last_name?: string | null
          max_uses?: number
          note?: string | null
          property?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
          used_count?: number
        }
        Relationships: []
      }
      invite_requests: {
        Row: {
          created_at: string
          email: string
          first_name: string
          generated_invite_code: string | null
          id: string
          last_name: string
          note: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["invite_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          generated_invite_code?: string | null
          id?: string
          last_name: string
          note?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["invite_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          generated_invite_code?: string | null
          id?: string
          last_name?: string
          note?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["invite_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      leases: {
        Row: {
          created_at: string
          end_date: string
          id: string
          landlord_id: string
          property_id: string | null
          public_slug: string
          rent_amount: number
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          landlord_id: string
          property_id?: string | null
          public_slug?: string
          rent_amount: number
          start_date: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          landlord_id?: string
          property_id?: string | null
          public_slug?: string
          rent_amount?: number
          start_date?: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          lease_id: string
          priority: Database["public"]["Enums"]["maintenance_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          lease_id: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          lease_id?: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_sessions: {
        Row: {
          device_id: string
          expires_at: string
          id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          device_id: string
          expires_at: string
          id?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          device_id?: string
          expires_at?: string
          id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          purpose?: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          account_mask: string | null
          account_type: string | null
          bank_name: string | null
          connected_account_id: string | null
          created_at: string
          id: string
          landlord_id: string
          provider: string
          provider_access_token: string
          provider_account_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_mask?: string | null
          account_type?: string | null
          bank_name?: string | null
          connected_account_id?: string | null
          created_at?: string
          id?: string
          landlord_id: string
          provider: string
          provider_access_token: string
          provider_account_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_mask?: string | null
          account_type?: string | null
          bank_name?: string | null
          connected_account_id?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          provider?: string
          provider_access_token?: string
          provider_account_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_status_audit: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_method: string | null
          new_paid_at: string | null
          new_status: Database["public"]["Enums"]["payment_status"]
          old_method: string | null
          old_paid_at: string | null
          old_status: Database["public"]["Enums"]["payment_status"] | null
          payment_id: string
          reason: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_method?: string | null
          new_paid_at?: string | null
          new_status: Database["public"]["Enums"]["payment_status"]
          old_method?: string | null
          old_paid_at?: string | null
          old_status?: Database["public"]["Enums"]["payment_status"] | null
          payment_id: string
          reason?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_method?: string | null
          new_paid_at?: string | null
          new_status?: Database["public"]["Enums"]["payment_status"]
          old_method?: string | null
          old_paid_at?: string | null
          old_status?: Database["public"]["Enums"]["payment_status"] | null
          payment_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          connected_account_id: string | null
          created_at: string
          destination_account_id: string | null
          due_date: string
          failure_reason: string | null
          id: string
          lease_id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          payment_method_id: string | null
          provider: string | null
          provider_transfer_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transfer_created_at: string | null
          transfer_error: string | null
          transfer_id: string | null
          transfer_status: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          connected_account_id?: string | null
          created_at?: string
          destination_account_id?: string | null
          due_date: string
          failure_reason?: string | null
          id?: string
          lease_id: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method_id?: string | null
          provider?: string | null
          provider_transfer_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transfer_created_at?: string | null
          transfer_error?: string | null
          transfer_id?: string | null
          transfer_status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          connected_account_id?: string | null
          created_at?: string
          destination_account_id?: string | null
          due_date?: string
          failure_reason?: string | null
          id?: string
          lease_id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method_id?: string | null
          provider?: string | null
          provider_transfer_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transfer_created_at?: string | null
          transfer_error?: string | null
          transfer_id?: string | null
          transfer_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          phone_e164: string | null
          phone_verified_at: string | null
          sms_2fa_consent: boolean
          sms_2fa_consent_at: string | null
          sms_2fa_consent_source: string | null
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean
          stripe_connect_details_submitted: boolean
          stripe_connect_payouts_enabled: boolean
          stripe_connect_updated_at: string | null
          stripe_customer_id: string | null
          stripe_pricing_table_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_status: string | null
          subscription_current_period_end: string | null
          subscription_price_id: string | null
          subscription_updated_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          sms_2fa_consent?: boolean
          sms_2fa_consent_at?: string | null
          sms_2fa_consent_source?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_details_submitted?: boolean
          stripe_connect_payouts_enabled?: boolean
          stripe_connect_updated_at?: string | null
          stripe_customer_id?: string | null
          stripe_pricing_table_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_status?: string | null
          subscription_current_period_end?: string | null
          subscription_price_id?: string | null
          subscription_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          phone_e164?: string | null
          phone_verified_at?: string | null
          sms_2fa_consent?: boolean
          sms_2fa_consent_at?: string | null
          sms_2fa_consent_source?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_details_submitted?: boolean
          stripe_connect_payouts_enabled?: boolean
          stripe_connect_updated_at?: string | null
          stripe_customer_id?: string | null
          stripe_pricing_table_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_status?: string | null
          subscription_current_period_end?: string | null
          subscription_price_id?: string | null
          subscription_updated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          city: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          public_slug: string
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address: string
          city?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          public_slug?: string
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          public_slug?: string
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          id: string
          label: string
          property_id: string
          rent_amount: number | null
          updated_at: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          label: string
          property_id: string
          rent_amount?: number | null
          updated_at?: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          label?: string
          property_id?: string
          rent_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gen_public_slug: { Args: never; Returns: string }
      generate_lease_payments: {
        Args: { _lease_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      landlord_has_lease_with_tenant: {
        Args: { _landlord_id: string; _tenant_id: string }
        Returns: boolean
      }
      landlord_invited_user: {
        Args: { _invited_user_id: string; _landlord_id: string }
        Returns: boolean
      }
      landlord_update_payment_status: {
        Args: {
          _method: string
          _new_status: Database["public"]["Enums"]["payment_status"]
          _payment_id: string
          _reason: string
        }
        Returns: {
          amount: number
          connected_account_id: string | null
          created_at: string
          destination_account_id: string | null
          due_date: string
          failure_reason: string | null
          id: string
          lease_id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          payment_method_id: string | null
          provider: string | null
          provider_transfer_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transfer_created_at: string | null
          transfer_error: string | null
          transfer_id: string | null
          transfer_status: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lease_id_from_object_path: { Args: { _name: string }; Returns: string }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_invite_code: {
        Args: { _code: string; _user_id: string }
        Returns: {
          message: string
          role: Database["public"]["Enums"]["app_role"]
          success: boolean
        }[]
      }
      tenant_has_lease_on_property: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      tenant_has_lease_on_unit: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      tenant_has_lease_with_landlord: {
        Args: { _landlord_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_lease_object: {
        Args: { _name: string; _user_id: string }
        Returns: boolean
      }
      user_owns_property: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "landlord" | "tenant"
      invite_request_status: "pending" | "approved" | "rejected"
      lease_status: "draft" | "active" | "ended" | "terminated"
      maintenance_priority: "low" | "medium" | "high" | "urgent"
      maintenance_status: "open" | "in_progress" | "resolved" | "closed"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "processing"
        | "returned"
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
      app_role: ["admin", "landlord", "tenant"],
      invite_request_status: ["pending", "approved", "rejected"],
      lease_status: ["draft", "active", "ended", "terminated"],
      maintenance_priority: ["low", "medium", "high", "urgent"],
      maintenance_status: ["open", "in_progress", "resolved", "closed"],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "processing",
        "returned",
      ],
    },
  },
} as const
