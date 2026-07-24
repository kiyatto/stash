/**
 * Hand-maintained types for the Supabase schema.
 * Regenerate with `supabase gen types typescript` once linked to a project.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          avatar_seed: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          avatar_seed?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          avatar_seed?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stashes: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          share_token: string | null;
          share_expires_at: string | null;
          cover_image_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string;
          share_token?: string | null;
          share_expires_at?: string | null;
          cover_image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          share_token?: string | null;
          share_expires_at?: string | null;
          cover_image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stashes_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stash_items: {
        Row: {
          id: string;
          stash_id: string;
          name: string;
          image_path: string | null;
          link: string | null;
          notes: string | null;
          x: number;
          y: number;
          width: number;
          height: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stash_id: string;
          name?: string;
          image_path?: string | null;
          link?: string | null;
          notes?: string | null;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          stash_id?: string;
          name?: string;
          image_path?: string | null;
          link?: string | null;
          notes?: string | null;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stash_items_stash_id_fkey";
            columns: ["stash_id"];
            isOneToOne: false;
            referencedRelation: "stashes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_stash_by_share_token: {
        Args: { token: string };
        Returns: {
          id: string;
          name: string;
          share_token: string;
          created_at: string;
          updated_at: string;
        }[];
      };
      get_stash_items_by_share_token: {
        Args: { token: string };
        Returns: Database["public"]["Tables"]["stash_items"]["Row"][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type StashRow = Database["public"]["Tables"]["stashes"]["Row"];
export type StashItemRow = Database["public"]["Tables"]["stash_items"]["Row"];
