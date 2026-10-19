// Sinh từ schema Supabase (generate_typescript_types) sau mỗi migration.
// Chỉnh tay duy nhất: đánh dấu nullable cho tham số/kết quả RPC mà Postgres không mô tả được (ghi chú `nullable`).

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
      account_approvals: {
        Row: { account_id: string; email: string | null; approved: boolean; created_at: string; approved_at: string | null };
        Insert: { account_id: string; email?: string | null; approved?: boolean; created_at?: string; approved_at?: string | null };
        Update: { account_id?: string; email?: string | null; approved?: boolean; created_at?: string; approved_at?: string | null };
        Relationships: [];
      };
      family_trees: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          outside_generations: number;
          owner_id: string;
          photo_path: string | null;
          public_token: string | null;
          public_password_hash: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          outside_generations?: number;
          owner_id?: string;
          photo_path?: string | null;
          public_token?: string | null;
          public_password_hash?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          outside_generations?: number;
          owner_id?: string;
          photo_path?: string | null;
          public_token?: string | null;
          public_password_hash?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      persons: {
        Row: {
          common_name: string | null;
          taboo_name: string | null;
          courtesy_name: string | null;
          han_name: string | null;
          birth_calendar: string;
          birth_precision: string | null;
          birth_month: number | null;
          birth_day: number | null;
          birth_leap: boolean;
          birth_approx: boolean;
          birth_solar_date: string | null;
          birth_place: string | null;
          hometown: string | null;
          residence: string | null;
          occupation: string | null;
          education: string | null;
          title: string | null;
          phone: string | null;
          email: string | null;
          biography: string | null;
          role_note: string | null;
          death_calendar: string;
          death_precision: string | null;
          death_month: number | null;
          death_day: number | null;
          death_leap: boolean;
          death_approx: boolean;
          death_solar_date: string | null;
          anniversary_day: number | null;
          anniversary_month: number | null;
          anniversary_manual: boolean;
          burial_place: string | null;
          burial_map_url: string | null;
          worship_place: string | null;
          worship_keeper: string | null;
          worship_keeper_id: string | null;
          birth_order: number | null;
          birth_year: number | null;
          created_at: string;
          death_year: number | null;
          full_name: string;
          gender: string | null;
          id: string;
          is_deceased: boolean;
          is_progenitor: boolean;
          founds_branch: boolean;
          tree_id: string;
          updated_at: string;
          version: number;
          hidden_from_public: boolean;
          avatar_path: string | null;
          created_by: string | null;
          pending_delete_by: string | null;
          pending_delete_at: string | null;
        };
        Insert: {
          common_name?: string | null;
          taboo_name?: string | null;
          courtesy_name?: string | null;
          han_name?: string | null;
          birth_calendar?: string;
          birth_precision?: string | null;
          birth_month?: number | null;
          birth_day?: number | null;
          birth_leap?: boolean;
          birth_approx?: boolean;
          birth_solar_date?: string | null;
          birth_place?: string | null;
          hometown?: string | null;
          residence?: string | null;
          occupation?: string | null;
          education?: string | null;
          title?: string | null;
          phone?: string | null;
          email?: string | null;
          biography?: string | null;
          role_note?: string | null;
          death_calendar?: string;
          death_precision?: string | null;
          death_month?: number | null;
          death_day?: number | null;
          death_leap?: boolean;
          death_approx?: boolean;
          death_solar_date?: string | null;
          anniversary_day?: number | null;
          anniversary_month?: number | null;
          anniversary_manual?: boolean;
          burial_place?: string | null;
          burial_map_url?: string | null;
          worship_place?: string | null;
          worship_keeper?: string | null;
          worship_keeper_id?: string | null;
          birth_order?: number | null;
          birth_year?: number | null;
          created_at?: string;
          death_year?: number | null;
          full_name: string;
          gender?: string | null;
          id?: string;
          is_deceased?: boolean;
          is_progenitor?: boolean;
          founds_branch?: boolean;
          tree_id: string;
          updated_at?: string;
          version?: number;
          hidden_from_public?: boolean;
          avatar_path?: string | null;
          created_by?: string | null;
          pending_delete_by?: string | null;
          pending_delete_at?: string | null;
        };
        Update: {
          common_name?: string | null;
          taboo_name?: string | null;
          courtesy_name?: string | null;
          han_name?: string | null;
          birth_calendar?: string;
          birth_precision?: string | null;
          birth_month?: number | null;
          birth_day?: number | null;
          birth_leap?: boolean;
          birth_approx?: boolean;
          birth_solar_date?: string | null;
          birth_place?: string | null;
          hometown?: string | null;
          residence?: string | null;
          occupation?: string | null;
          education?: string | null;
          title?: string | null;
          phone?: string | null;
          email?: string | null;
          biography?: string | null;
          role_note?: string | null;
          death_calendar?: string;
          death_precision?: string | null;
          death_month?: number | null;
          death_day?: number | null;
          death_leap?: boolean;
          death_approx?: boolean;
          death_solar_date?: string | null;
          anniversary_day?: number | null;
          anniversary_month?: number | null;
          anniversary_manual?: boolean;
          burial_place?: string | null;
          burial_map_url?: string | null;
          worship_place?: string | null;
          worship_keeper?: string | null;
          worship_keeper_id?: string | null;
          birth_order?: number | null;
          birth_year?: number | null;
          created_at?: string;
          death_year?: number | null;
          full_name?: string;
          gender?: string | null;
          id?: string;
          is_deceased?: boolean;
          is_progenitor?: boolean;
          founds_branch?: boolean;
          tree_id?: string;
          updated_at?: string;
          version?: number;
          hidden_from_public?: boolean;
          avatar_path?: string | null;
          created_by?: string | null;
          pending_delete_by?: string | null;
          pending_delete_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'persons_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'persons_worship_keeper_id_fkey';
            columns: ['worship_keeper_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
        ];
      };
      parent_links: {
        Row: { child_id: string; created_at: string; kind: string; parent_id: string; tree_id: string };
        Insert: { child_id: string; created_at?: string; kind?: string; parent_id: string; tree_id?: string };
        Update: { child_id?: string; created_at?: string; kind?: string; parent_id?: string; tree_id?: string };
        Relationships: [];
      };
      person_photos: {
        Row: {
          id: string;
          tree_id: string;
          person_id: string;
          storage_path: string;
          caption: string | null;
          is_avatar: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tree_id?: string;
          person_id: string;
          storage_path: string;
          caption?: string | null;
          is_avatar?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tree_id?: string;
          person_id?: string;
          storage_path?: string;
          caption?: string | null;
          is_avatar?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pha_do_configs: {
        Row: { tree_id: string; config: Json; updated_by: string | null; updated_at: string };
        Insert: { tree_id: string; config: Json; updated_by?: string | null; updated_at?: string };
        Update: { tree_id?: string; config?: Json; updated_by?: string | null; updated_at?: string };
        Relationships: [];
      };
      tree_events: {
        Row: {
          id: string;
          tree_id: string;
          title: string;
          calendar: string;
          repeats_yearly: boolean;
          year: number | null;
          month: number;
          day: number;
          leap: boolean;
          start_time: string | null;
          location: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tree_id: string;
          title: string;
          calendar?: string;
          repeats_yearly?: boolean;
          year?: number | null;
          month: number;
          day: number;
          leap?: boolean;
          start_time?: string | null;
          location?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tree_id?: string;
          title?: string;
          calendar?: string;
          repeats_yearly?: boolean;
          year?: number | null;
          month?: number;
          day?: number;
          leap?: boolean;
          start_time?: string | null;
          location?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      unions: {
        Row: {
          created_at: string;
          id: string;
          order_for_a: number;
          order_for_b: number;
          partner_a: string;
          partner_b: string;
          status: string;
          tree_id: string;
          marriage_year: number | null;
          marriage_month: number | null;
          marriage_day: number | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_for_a?: number;
          order_for_b?: number;
          partner_a: string;
          partner_b: string;
          status?: string;
          tree_id?: string;
          marriage_year?: number | null;
          marriage_month?: number | null;
          marriage_day?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_for_a?: number;
          order_for_b?: number;
          partner_a?: string;
          partner_b?: string;
          status?: string;
          tree_id?: string;
          marriage_year?: number | null;
          marriage_month?: number | null;
          marriage_day?: number | null;
        };
        Relationships: [];
      };
      tree_roles: {
        Row: { account_id: string; created_at: string; role: string; tree_id: string; linked_person_id: string | null };
        Insert: { account_id: string; created_at?: string; role: string; tree_id: string; linked_person_id?: string | null };
        Update: { account_id?: string; created_at?: string; role?: string; tree_id?: string; linked_person_id?: string | null };
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
      reminder_watch: {
        Row: { account_id: string; person_id: string; tree_id: string; created_at: string };
        Insert: { account_id?: string; person_id: string; tree_id?: string; created_at?: string };
        Update: { account_id?: string; person_id?: string; tree_id?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: 'reminder_watch_person_id_fkey';
            columns: ['person_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reminder_watch_tree_id_fkey';
            columns: ['tree_id'];
            isOneToOne: false;
            referencedRelation: 'family_trees';
            referencedColumns: ['id'];
          },
        ];
      };
      reminder_prefs: {
        Row: { account_id: string; tree_id: string; offset_days: number; email_enabled: boolean; updated_at: string };
        Insert: { account_id?: string; tree_id: string; offset_days?: number; email_enabled?: boolean; updated_at?: string };
        Update: { account_id?: string; tree_id?: string; offset_days?: number; email_enabled?: boolean; updated_at?: string };
        Relationships: [];
      };
      notification_reads: {
        Row: { account_id: string; notification_key: string; read_at: string };
        Insert: { account_id?: string; notification_key: string; read_at?: string };
        Update: { account_id?: string; notification_key?: string; read_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      add_child: {
        // nullable: other_parent_id
        Args: { link_kind: string; other_parent_id: string | null; parent_id: string; person: Json };
        Returns: string;
      };
      add_parent: { Args: { child_id: string; link_kind: string; person: Json }; Returns: string };
      // nullable: union_order
      add_spouse: { Args: { person: Json; person_id: string; union_order: number | null }; Returns: string };
      can_edit_tree: { Args: { target_tree: string }; Returns: boolean };
      can_view_tree: { Args: { target_tree: string }; Returns: boolean };
      is_tree_owner: { Args: { target_tree: string }; Returns: boolean };
      set_progenitor: { Args: { person_id: string }; Returns: undefined };
      set_avatar_photo: { Args: { photo_id: string }; Returns: undefined };
      link_account_to_person: { Args: { target_tree: string; person_id: string }; Returns: undefined };
      link_parent: { Args: { child_id: string; parent_id: string; link_kind: string }; Returns: undefined };
      link_spouse: { Args: { person_id: string; spouse_id: string }; Returns: undefined };
      rotate_public_link: { Args: { target_tree: string; password: string }; Returns: string };
      set_public_link_password: { Args: { target_tree: string; password: string }; Returns: undefined };
      disable_public_link: { Args: { target_tree: string }; Returns: undefined };
      public_tree: { Args: { token: string; password: string | null }; Returns: Json };
      public_tree_card: { Args: { token: string }; Returns: Json };
      rotate_calendar_feed: { Args: Record<string, never>; Returns: string };
      my_calendar_feed: { Args: Record<string, never>; Returns: string | null };
      disable_calendar_feed: { Args: Record<string, never>; Returns: undefined };
      reorder_children: { Args: { ordered_ids: string[] }; Returns: undefined };
      merge_persons: { Args: { keep_person: string; drop_person: string }; Returns: undefined };
      import_into_tree: { Args: { target_tree: string; payload: Json }; Returns: number };
      import_new_tree: { Args: { tree_name: string; payload: Json }; Returns: string };
      tree_positions: {
        Args: { target_tree: string };
        // nullable: generation, branch_id
        Returns: { branch_id: string | null; generation: number | null; kind: string; person_id: string }[];
      };
      invite_to_tree: { Args: { target_tree: string; invite_email: string; new_role: string }; Returns: undefined };
      update_tree_role: { Args: { target_tree: string; target_account: string; new_role: string }; Returns: undefined };
      remove_tree_role: { Args: { target_tree: string; target_account: string }; Returns: undefined };
      list_tree_members: {
        Args: { target_tree: string };
        Returns: { account_id: string; role: string; email: string; created_at: string }[];
      };
      request_delete_person: { Args: { target_person: string }; Returns: undefined };
      approve_delete_person: { Args: { target_person: string }; Returns: undefined };
      reject_delete_person: { Args: { target_person: string }; Returns: undefined };
      list_pending_deletions: {
        Args: { target_tree: string };
        Returns: { person_id: string; full_name: string; requested_by_email: string; requested_at: string }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database['public']['Tables'];
export type Row<Table extends keyof PublicTables> = PublicTables[Table]['Row'];
export type Insert<Table extends keyof PublicTables> = PublicTables[Table]['Insert'];
export type Update<Table extends keyof PublicTables> = PublicTables[Table]['Update'];
