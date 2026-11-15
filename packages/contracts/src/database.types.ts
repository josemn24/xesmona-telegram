export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bots: {
        Row: {
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      game_moves: {
        Row: {
          created_at: string
          game_id: string
          move: Json
          round: number
          seat: number
          version: number
        }
        Insert: {
          created_at?: string
          game_id: string
          move: Json
          round: number
          seat: number
          version: number
        }
        Update: {
          created_at?: string
          game_id?: string
          move?: Json
          round?: number
          seat?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          display_name: string
          game_id: string
          joined_at: string
          kind: string
          seat: number
          telegram_user_id: number | null
        }
        Insert: {
          display_name: string
          game_id: string
          joined_at?: string
          kind: string
          seat: number
          telegram_user_id?: number | null
        }
        Update: {
          display_name?: string
          game_id?: string
          joined_at?: string
          kind?: string
          seat?: number
          telegram_user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_telegram_user_id_fkey"
            columns: ["telegram_user_id"]
            isOneToOne: false
            referencedRelation: "telegram_users"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          bot_id: string
          bot_level: string | null
          chat_id: number | null
          chat_instance: string | null
          created_at: string
          created_by: number
          game_type: string
          id: string
          inline_message_id: string | null
          message_id: number | null
          message_thread_id: number | null
          mode: string | null
          result: string | null
          round: number
          state: Json
          status: string
          updated_at: string
          version: number
          winner_seat: number | null
        }
        Insert: {
          bot_id: string
          bot_level?: string | null
          chat_id?: number | null
          chat_instance?: string | null
          created_at?: string
          created_by: number
          game_type: string
          id?: string
          inline_message_id?: string | null
          message_id?: number | null
          message_thread_id?: number | null
          mode?: string | null
          result?: string | null
          round?: number
          state: Json
          status?: string
          updated_at?: string
          version?: number
          winner_seat?: number | null
        }
        Update: {
          bot_id?: string
          bot_level?: string | null
          chat_id?: number | null
          chat_instance?: string | null
          created_at?: string
          created_by?: number
          game_type?: string
          id?: string
          inline_message_id?: string | null
          message_id?: number | null
          message_thread_id?: number | null
          mode?: string | null
          result?: string | null
          round?: number
          state?: Json
          status?: string
          updated_at?: string
          version?: number
          winner_seat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "telegram_users"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_users: {
        Row: {
          created_at: string
          first_name: string
          id: number
          language_code: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name: string
          id: number
          language_code?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: number
          language_code?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attach_message: {
        Args: {
          p_chat_id: number
          p_game_id: string
          p_message_id: number
          p_message_thread_id?: number
        }
        Returns: {
          bot_id: string
          bot_level: string | null
          chat_id: number | null
          chat_instance: string | null
          created_at: string
          created_by: number
          game_type: string
          id: string
          inline_message_id: string | null
          message_id: number | null
          message_thread_id: number | null
          mode: string | null
          result: string | null
          round: number
          state: Json
          status: string
          updated_at: string
          version: number
          winner_seat: number | null
        }
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_game: {
        Args: {
          p_bot_id: string
          p_bot_level?: string
          p_chat_instance?: string
          p_created_by: number
          p_game_type: string
          p_inline_message_id?: string
          p_mode?: string
          p_players: Json
          p_state: Json
          p_status: string
        }
        Returns: {
          bot_id: string
          bot_level: string | null
          chat_id: number | null
          chat_instance: string | null
          created_at: string
          created_by: number
          game_type: string
          id: string
          inline_message_id: string | null
          message_id: number | null
          message_thread_id: number | null
          mode: string | null
          result: string | null
          round: number
          state: Json
          status: string
          updated_at: string
          version: number
          winner_seat: number | null
        }
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_game_player: {
        Args: { p_game_id: string; p_user_id: number }
        Returns: boolean
      }
      join_game: {
        Args: {
          p_display_name: string
          p_expected_version: number
          p_game_id: string
          p_state: Json
          p_telegram_user_id: number
        }
        Returns: {
          bot_id: string
          bot_level: string | null
          chat_id: number | null
          chat_instance: string | null
          created_at: string
          created_by: number
          game_type: string
          id: string
          inline_message_id: string | null
          message_id: number | null
          message_thread_id: number | null
          mode: string | null
          result: string | null
          round: number
          state: Json
          status: string
          updated_at: string
          version: number
          winner_seat: number | null
        }
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_game: {
        Args: {
          p_expected_version: number
          p_game_id: string
          p_moves?: Json
          p_result?: string
          p_round: number
          p_state: Json
          p_status: string
          p_winner_seat?: number
        }
        Returns: {
          bot_id: string
          bot_level: string | null
          chat_id: number | null
          chat_instance: string | null
          created_at: string
          created_by: number
          game_type: string
          id: string
          inline_message_id: string | null
          message_id: number | null
          message_thread_id: number | null
          mode: string | null
          result: string | null
          round: number
          state: Json
          status: string
          updated_at: string
          version: number
          winner_seat: number | null
        }
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_vs_bot: {
        Args: {
          p_bot_level: string
          p_bot_name: string
          p_expected_version: number
          p_game_id: string
          p_state: Json
        }
        Returns: {
          bot_id: string
          bot_level: string | null
          chat_id: number | null
          chat_instance: string | null
          created_at: string
          created_by: number
          game_type: string
          id: string
          inline_message_id: string | null
          message_id: number | null
          message_thread_id: number | null
          mode: string | null
          result: string | null
          round: number
          state: Json
          status: string
          updated_at: string
          version: number
          winner_seat: number | null
        }
        SetofOptions: {
          from: "*"
          to: "games"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

