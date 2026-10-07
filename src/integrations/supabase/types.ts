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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          hotel_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          hotel_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          hotel_id?: string | null
          id?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          available: boolean
          description: string
          duration_minutes: number | null
          hotel_id: string
          id: string
          module: string
          name: string
          price: number
          sort: number
        }
        Insert: {
          available?: boolean
          description?: string
          duration_minutes?: number | null
          hotel_id: string
          id?: string
          module: string
          name: string
          price?: number
          sort?: number
        }
        Update: {
          available?: boolean
          description?: string
          duration_minutes?: number | null
          hotel_id?: string
          id?: string
          module?: string
          name?: string
          price?: number
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_threads: {
        Row: {
          guest_id: string
          id: string
          messages: Json
          updated_at: string
        }
        Insert: {
          guest_id: string
          id?: string
          messages?: Json
          updated_at?: string
        }
        Update: {
          guest_id?: string
          id?: string
          messages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concierge_threads_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: true
            referencedRelation: "stay_guests"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          created_at: string
          guest_id: string
          hotel_id: string
          id: string
          reason: string
          status: string
          stay_id: string
          transcript: Json
        }
        Insert: {
          created_at?: string
          guest_id: string
          hotel_id: string
          id?: string
          reason: string
          status?: string
          stay_id: string
          transcript?: Json
        }
        Update: {
          created_at?: string
          guest_id?: string
          hotel_id?: string
          id?: string
          reason?: string
          status?: string
          stay_id?: string
          transcript?: Json
        }
        Relationships: [
          {
            foreignKeyName: "escalations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "stay_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_charges: {
        Row: {
          amount: number
          category: string
          charged_by_guest_id: string | null
          created_at: string
          description: string
          hotel_id: string
          id: string
          source_id: string | null
          source_type: string | null
          stay_id: string
        }
        Insert: {
          amount: number
          category: string
          charged_by_guest_id?: string | null
          created_at?: string
          description: string
          hotel_id: string
          id?: string
          source_id?: string | null
          source_type?: string | null
          stay_id: string
        }
        Update: {
          amount?: number
          category?: string
          charged_by_guest_id?: string | null
          created_at?: string
          description?: string
          hotel_id?: string
          id?: string
          source_id?: string | null
          source_type?: string | null
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folio_charges_charged_by_guest_id_fkey"
            columns: ["charged_by_guest_id"]
            isOneToOne: false
            referencedRelation: "stay_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_charges_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_charges_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          label: string | null
          max_uses: number
          revoked: boolean
          stay_id: string
          token_hash: string
          uses: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          label?: string | null
          max_uses?: number
          revoked?: boolean
          stay_id: string
          token_hash: string
          uses?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          label?: string | null
          max_uses?: number
          revoked?: boolean
          stay_id?: string
          token_hash?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_invites_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          ai_rules: string
          approval_threshold: number
          created_at: string
          currency: string
          id: string
          info: Json
          modules: Json
          name: string
          slug: string
          tagline: string | null
          tax_rate: number
        }
        Insert: {
          ai_rules?: string
          approval_threshold?: number
          created_at?: string
          currency?: string
          id?: string
          info?: Json
          modules?: Json
          name: string
          slug: string
          tagline?: string | null
          tax_rate?: number
        }
        Update: {
          ai_rules?: string
          approval_threshold?: number
          created_at?: string
          currency?: string
          id?: string
          info?: Json
          modules?: Json
          name?: string
          slug?: string
          tagline?: string | null
          tax_rate?: number
        }
        Relationships: []
      }
      itinerary_items: {
        Row: {
          category: string
          created_at: string
          ends_at: string
          guest_id: string | null
          id: string
          location: string | null
          source_id: string | null
          source_type: string | null
          starts_at: string
          stay_id: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          ends_at: string
          guest_id?: string | null
          id?: string
          location?: string | null
          source_id?: string | null
          source_type?: string | null
          starts_at: string
          stay_id: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          ends_at?: string
          guest_id?: string | null
          id?: string
          location?: string | null
          source_id?: string | null
          source_type?: string | null
          starts_at?: string
          stay_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "stay_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          hotel_id: string
          id: string
          name: string
          sort: number
        }
        Insert: {
          hotel_id: string
          id?: string
          name: string
          sort?: number
        }
        Update: {
          hotel_id?: string
          id?: string
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available: boolean
          category_id: string
          description: string
          hotel_id: string
          id: string
          image_key: string | null
          is_veg: boolean
          name: string
          options: Json
          price: number
          sort: number
          tags: string[]
        }
        Insert: {
          available?: boolean
          category_id: string
          description?: string
          hotel_id: string
          id?: string
          image_key?: string | null
          is_veg?: boolean
          name: string
          options?: Json
          price: number
          sort?: number
          tags?: string[]
        }
        Update: {
          available?: boolean
          category_id?: string
          description?: string
          hotel_id?: string
          id?: string
          image_key?: string | null
          is_veg?: boolean
          name?: string
          options?: Json
          price?: number
          sort?: number
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total: number
          menu_item_id: string | null
          name: string
          options: Json
          order_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          menu_item_id?: string | null
          name: string
          options?: Json
          order_id: string
          qty: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          menu_item_id?: string | null
          name?: string
          options?: Json
          order_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          destination_room_id: string
          hotel_id: string
          id: string
          idempotency_key: string
          notes: string | null
          payer_guest_id: string
          payment_method: string
          source: string
          status: string
          status_history: Json
          stay_id: string
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          created_at?: string
          destination_room_id: string
          hotel_id: string
          id?: string
          idempotency_key: string
          notes?: string | null
          payer_guest_id: string
          payment_method?: string
          source?: string
          status?: string
          status_history?: Json
          stay_id: string
          subtotal: number
          tax: number
          total: number
        }
        Update: {
          created_at?: string
          destination_room_id?: string
          hotel_id?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          payer_guest_id?: string
          payment_method?: string
          source?: string
          status?: string
          status_history?: Json
          stay_id?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_destination_room_id_fkey"
            columns: ["destination_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payer_guest_id_fkey"
            columns: ["payer_guest_id"]
            isOneToOne: false
            referencedRelation: "stay_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      room_qr_codes: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          revoked: boolean
          room_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          revoked?: boolean
          room_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          revoked?: boolean
          room_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_qr_codes_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_qr_codes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          hotel_id: string
          id: string
          number: string
          room_type: string
        }
        Insert: {
          hotel_id: string
          id?: string
          number: string
          room_type?: string
        }
        Update: {
          hotel_id?: string
          id?: string
          number?: string
          room_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          amount: number
          assigned_to: string | null
          catalog_item_id: string | null
          created_at: string
          destination_room_id: string
          details: string | null
          guest_id: string
          hotel_id: string
          id: string
          module: string
          scheduled_for: string | null
          source: string
          status: string
          status_history: Json
          stay_id: string
          title: string
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          catalog_item_id?: string | null
          created_at?: string
          destination_room_id: string
          details?: string | null
          guest_id: string
          hotel_id: string
          id?: string
          module: string
          scheduled_for?: string | null
          source?: string
          status?: string
          status_history?: Json
          stay_id: string
          title: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          catalog_item_id?: string | null
          created_at?: string
          destination_room_id?: string
          details?: string | null
          guest_id?: string
          hotel_id?: string
          id?: string
          module?: string
          scheduled_for?: string | null
          source?: string
          status?: string
          status_history?: Json
          stay_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_destination_room_id_fkey"
            columns: ["destination_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "stay_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_guests: {
        Row: {
          created_at: string
          display_name: string | null
          hotel_id: string
          id: string
          is_primary: boolean
          stay_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          hotel_id: string
          id?: string
          is_primary?: boolean
          stay_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          hotel_id?: string
          id?: string
          is_primary?: boolean
          stay_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_guests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_guests_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stays: {
        Row: {
          check_in: string
          check_out: string
          code: string
          created_at: string
          hotel_id: string
          id: string
          primary_guest_name: string
          room_charge_enabled: boolean
          room_id: string
          status: string
        }
        Insert: {
          check_in: string
          check_out: string
          code: string
          created_at?: string
          hotel_id: string
          id?: string
          primary_guest_name: string
          room_charge_enabled?: boolean
          room_id: string
          status?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          code?: string
          created_at?: string
          hotel_id?: string
          id?: string
          primary_guest_name?: string
          room_charge_enabled?: boolean
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stays_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_attempts: {
        Row: {
          client_key: string | null
          created_at: string
          id: string
          kind: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          client_key?: string | null
          created_at?: string
          id?: string
          kind: string
          success: boolean
          user_id?: string | null
        }
        Update: {
          client_key?: string | null
          created_at?: string
          id?: string
          kind?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_stay_member: { Args: { _stay_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
