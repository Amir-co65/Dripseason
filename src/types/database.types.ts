/**
 * These types describe the exact shape of our Postgres tables, so that
 * every `supabase.from('profiles')...` call in the app is fully type-checked
 * and autocompletes in your editor.
 *
 * We're writing these by hand for now, matching the migrations in
 * /supabase/migrations exactly. Later, once the Supabase CLI is set up, you
 * can generate this file automatically from your real database instead of
 * maintaining it by hand - the README explains that command. If you ever
 * add or change a column in a migration, update the matching type here too.
 */

export type UserRole = "admin" | "worker";
export type NotificationType = "info" | "success" | "warning" | "error";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          is_active?: boolean;
        };
      };
      activity_logs: {
        Row: {
          id: number;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: never; // activity_logs is append-only, see migration 0007
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          created_by: string | null;
          title: string;
          message: string | null;
          type: NotificationType;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_by?: string | null;
          title: string;
          message?: string | null;
          type?: NotificationType;
        };
        Update: {
          is_read?: boolean;
        };
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      claim_admin_role: {
        Args: { input_code: string };
        Returns: boolean;
      };
    };
  };
}
