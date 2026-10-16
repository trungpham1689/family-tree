// Sinh từ schema Supabase (generate_typescript_types). Đừng sửa tay; sinh lại sau mỗi migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      app_settings: {
        Row: { key: string; value: number };
        Insert: { key: string; value: number };
        Update: { key?: string; value?: number };
        Relationships: [];
      };
      family_trees: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      persons: {
        Row: {
          birth_year: number | null;
          created_at: string;
          death_year: number | null;
          full_name: string;
          gender: string | null;
          id: string;
          is_deceased: boolean;
          tree_id: string;
          updated_at: string;
        };
        Insert: {
          birth_year?: number | null;
          created_at?: string;
          death_year?: number | null;
          full_name: string;
          gender?: string | null;
          id?: string;
          is_deceased?: boolean;
          tree_id: string;
          updated_at?: string;
        };
        Update: {
          birth_year?: number | null;
          created_at?: string;
          death_year?: number | null;
          full_name?: string;
          gender?: string | null;
          id?: string;
          is_deceased?: boolean;
          tree_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'persons_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      tree_roles: {
        Row: { account_id: string; created_at: string; role: string; tree_id: string };
        Insert: { account_id: string; created_at?: string; role: string; tree_id: string };
        Update: { account_id?: string; created_at?: string; role?: string; tree_id?: string };
        Relationships: [
          {
            foreignKeyName: 'tree_roles_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      can_edit_tree: { Args: { target_tree: string }; Returns: boolean };
      can_view_tree: { Args: { target_tree: string }; Returns: boolean };
      is_tree_owner: { Args: { target_tree: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database['public']['Tables'];
export type Row<Table extends keyof PublicTables> = PublicTables[Table]['Row'];
export type Insert<Table extends keyof PublicTables> = PublicTables[Table]['Insert'];
export type Update<Table extends keyof PublicTables> = PublicTables[Table]['Update'];
