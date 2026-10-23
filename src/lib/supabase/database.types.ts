// 由 Supabase MCP generate_typescript_types 產生（里程碑 3 migration 之後）。
// 資料表或函式變更後請重新產生，不要手動修改。
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
      accounts: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_archived: boolean
          is_system: boolean
          ledger_id: string
          name: string
          parent_id: string | null
          sort_order: number
          subtype: string | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_system?: boolean
          ledger_id: string
          name: string
          parent_id?: string | null
          sort_order?: number
          subtype?: string | null
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_system?: boolean
          ledger_id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          subtype?: string | null
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          ledger_id: string
          month: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          ledger_id: string
          month: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          ledger_id?: string
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          entry_date: string
          from_account_id: string | null
          id: string
          kind: Database["public"]["Enums"]["entry_kind"]
          ledger_id: string
          memo: string | null
          to_account_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          entry_date: string
          from_account_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["entry_kind"]
          ledger_id: string
          memo?: string | null
          to_account_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          entry_date?: string
          from_account_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["entry_kind"]
          ledger_id?: string
          memo?: string | null
          to_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "entries_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "entries_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          entry_id: string
          id: string
          ledger_id: string
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          ledger_id: string
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          ledger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_lines_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          ledger_id: string
          name: string
          note: string | null
          target_amount: number
          target_date: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          ledger_id: string
          name: string
          note?: string | null
          target_amount: number
          target_date?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          ledger_id?: string
          name?: string
          note?: string | null
          target_amount?: number
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          cover_color: string | null
          cover_material: string | null
          created_at: string
          currency: string
          id: string
          name: string
          owner_id: string
          start_date: string
        }
        Insert: {
          cover_color?: string | null
          cover_material?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          owner_id?: string
          start_date?: string
        }
        Update: {
          cover_color?: string | null
          cover_material?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          owner_id?: string
          start_date?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          slogan: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          slogan?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          slogan?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          ledger_id: string | null
          line_count: number | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assert_entry_balanced: {
        Args: { p_entry_id: string }
        Returns: undefined
      }
      complete_onboarding: {
        Args: { p_accounts: Json; p_name: string; p_start_date: string }
        Returns: undefined
      }
      create_ledger_with_defaults: {
        Args: { p_name?: string }
        Returns: string
      }
      is_ledger_owner: { Args: { p_ledger_id: string }; Returns: boolean }
      monthly_summary: {
        Args: { p_from: string; p_ledger: string; p_to: string }
        Returns: {
          expense: number
          income: number
          month: string
        }[]
      }
      move_account: {
        Args: { p_account_id: string; p_direction: string }
        Returns: undefined
      }
      report_balance_sheet: {
        Args: { p_as_of: string; p_ledger: string }
        Returns: {
          account_id: string
          balance: number
          color: string
          icon: string
          is_archived: boolean
          is_system: boolean
          name: string
          sort_order: number
          subtype: string
          type: Database["public"]["Enums"]["account_type"]
        }[]
      }
      report_cash_flow: {
        Args: { p_from: string; p_ledger: string; p_to: string }
        Returns: {
          account_id: string
          activity: string
          color: string
          icon: string
          inflow: number
          name: string
          outflow: number
          section: string
        }[]
      }
      report_income_statement: {
        Args: { p_from: string; p_ledger: string; p_to: string }
        Returns: {
          account_id: string
          amount: number
          color: string
          icon: string
          name: string
          parent_id: string
          sort_order: number
          type: Database["public"]["Enums"]["account_type"]
        }[]
      }
      save_entry: { Args: { p_entry: Json; p_lines: Json }; Returns: string }
      seed_ledger: {
        Args: { p_name: string; p_owner: string }
        Returns: string
      }
      set_opening_balance: {
        Args: { p_account_id: string; p_amount: number }
        Returns: string
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      entry_kind: "income" | "expense" | "transfer" | "opening" | "adjustment"
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
    Enums: {
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      entry_kind: ["income", "expense", "transfer", "opening", "adjustment"],
    },
  },
} as const
