/**
 * Hand-written types matching every migration in /supabase/migrations.
 * Once things settle, generate this file for real instead with:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.types.ts
 * Until then, if you add/change a column in a migration, mirror it here too.
 */

export type UserRole = "admin" | "worker";
export type NotificationType = "info" | "success" | "warning" | "error";
export type InventoryStatus = "available" | "listed" | "sold" | "traded" | "archived";
export type ArrivalStatus = "arrived" | "arriving";
export type MediaKind = "photo" | "link";
/** Platform slugs are database-managed; do not turn this back into a union. */
export type Platform = string;
export type WalletBucket = string;
export type PostingStatus = "needs_posting" | "skipped" | "posted";
export type TradeKind = "standard-trade" | "return-exchange";

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
        Insert: { id: string; email: string; full_name?: string | null; avatar_url?: string | null };
        Update: { full_name?: string | null; avatar_url?: string | null; role?: UserRole; is_active?: boolean };
        Relationships: [];
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
        Update: never;
        Relationships: [];
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
        Update: { is_read?: boolean };
        Relationships: [];
      };

      chapters: {
        Row: {
          id: string;
          name: string;
          date_range: string | null;
          chapter_number: number | null;
          legacy_id: string | null;
          legacy_raw: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          period_start: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          date_range?: string | null;
          chapter_number?: number | null;
          legacy_id?: string | null;
          legacy_raw?: Record<string, unknown> | null;
          created_by?: string | null;
          period_start?: string | null;
        };
        Update: Partial<{ name: string; date_range: string | null; chapter_number: number | null; period_start: string | null }>;
        Relationships: [];
      };

      packages: {
        Row: {
          id: string;
          chapter_id: string;
          title: string;
          package_number: number | null;
          package_date: string | null;
          info: string | null;
          shipping_cost: number;
          shipping_code: string | null;
          arrival_status: ArrivalStatus | null;
          legacy_id: string | null;
          legacy_raw: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chapter_id: string;
          title: string;
          package_number?: number | null;
          package_date?: string | null;
          info?: string | null;
          shipping_cost?: number;
          shipping_code?: string | null;
          arrival_status?: ArrivalStatus | null;
          legacy_id?: string | null;
          legacy_raw?: Record<string, unknown> | null;
          created_by?: string | null;
        };
        Update: Partial<{
          title: string;
          package_date: string | null;
          info: string | null;
          shipping_cost: number;
          shipping_code: string | null;
          arrival_status: ArrivalStatus | null;
        }>;
        Relationships: [];
      };

      inventory_items: {
        Row: {
          id: string;
          sku: string | null;
          item_name: string;
          brand: string | null;
          category: string | null;
          size: string | null;
          color: string | null;
          description: string | null;
          notes: string | null;
          purchase_price: number | null;
          asking_price: number;
          sold_price: number | null;
          status: InventoryStatus;
          package_id: string | null;
          closet_location: string | null;
          legacy_id: string | null;
          legacy_public_id: string | null;
          legacy_raw: Record<string, unknown> | null;
          vinted_posting_status: PostingStatus;
          vinted_posting_account_id: string | null;
          plick_posting_status: PostingStatus;
          plick_posting_account_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          sku?: string | null;
          item_name: string;
          brand?: string | null;
          category?: string | null;
          size?: string | null;
          color?: string | null;
          description?: string | null;
          notes?: string | null;
          purchase_price?: number | null;
          asking_price?: number;
          sold_price?: number | null;
          status?: InventoryStatus;
          package_id?: string | null;
          closet_location?: string | null;
          legacy_id?: string | null;
          legacy_public_id?: string | null;
          legacy_raw?: Record<string, unknown> | null;
          vinted_posting_status?: PostingStatus;
          vinted_posting_account_id?: string | null;
          plick_posting_status?: PostingStatus;
          plick_posting_account_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{
          item_name: string;
          sku: string | null;
          brand: string | null;
          category: string | null;
          size: string | null;
          color: string | null;
          description: string | null;
          notes: string | null;
          purchase_price: number | null;
          asking_price: number;
          sold_price: number | null;
          status: InventoryStatus;
          package_id: string | null;
          closet_location: string | null;
          vinted_posting_status: PostingStatus;
          vinted_posting_account_id: string | null;
          plick_posting_status: PostingStatus;
          plick_posting_account_id: string | null;
          deleted_at: string | null;
        }>;
        Relationships: [];
      };

      item_media: {
        Row: {
          id: string;
          inventory_item_id: string;
          kind: MediaKind;
          storage_path: string | null;
          external_url: string | null;
          position: number;
          legacy_raw: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_item_id: string;
          kind: MediaKind;
          storage_path?: string | null;
          external_url?: string | null;
          position?: number;
          legacy_raw?: Record<string, unknown> | null;
          created_by?: string | null;
        };
        Update: Partial<{ position: number }>;
        Relationships: [];
      };

      sales: {
        Row: {
          id: string;
          inventory_item_id: string;
          sold_price: number;
          sale_date: string | null;
          sale_platform: string | null;
          buyer_note: string | null;
          marketplace_account_id: string | null;
          legacy_id: string | null;
          legacy_source_chapter_name: string | null;
          legacy_source_package_title: string | null;
          legacy_sale_account_label: string | null;
          legacy_sale_account_number: string | null;
          legacy_raw: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          inventory_item_id: string;
          sold_price: number;
          sale_date?: string | null;
          sale_platform?: string | null;
          buyer_note?: string | null;
          marketplace_account_id?: string | null;
          legacy_id?: string | null;
          legacy_source_chapter_name?: string | null;
          legacy_source_package_title?: string | null;
          legacy_sale_account_label?: string | null;
          legacy_sale_account_number?: string | null;
          legacy_raw?: Record<string, unknown> | null;
          created_by?: string | null;
        };
        Update: Partial<{
          sold_price: number;
          sale_date: string | null;
          sale_platform: string | null;
          buyer_note: string | null;
          marketplace_account_id: string | null;
        }>;
        Relationships: [];
      };

      marketplace_accounts: {
        Row: {
          id: string;
          platform: Platform;
          label: string;
          posting_account_number: number | null;
          balance: number;
          email: string | null;
          username: string | null;
          password: string | null;
          phone: string | null;
          notes: string | null;
          banned: boolean;
          legacy_id: string | null;
          legacy_raw: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          account_owner_id: string | null;
        };
        Insert: {
          id?: string;
          platform: Platform;
          label: string;
          posting_account_number?: number | null;
          balance?: number;
          email?: string | null;
          username?: string | null;
          password?: string | null;
          phone?: string | null;
          notes?: string | null;
          banned?: boolean;
          legacy_id?: string | null;
          legacy_raw?: Record<string, unknown> | null;
          created_by?: string | null;
          account_owner_id?: string | null;
        };
        Update: Partial<{
          label: string;
          posting_account_number: number | null;
          balance: number;
          email: string | null;
          username: string | null;
          password: string | null;
          phone: string | null;
          notes: string | null;
          banned: boolean;
        }>;
        Relationships: [];
      };

      posting_accounts: {
        Row: {
          id: string;
          platform: Platform;
          account_number: number;
          display_name: string;
          marketplace_account_id: string | null;
          legacy_raw: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          platform: Platform;
          account_number: number;
          display_name: string;
          marketplace_account_id?: string | null;
          legacy_raw?: Record<string, unknown> | null;
        };
        Update: Partial<{ display_name: string; marketplace_account_id: string | null }>;
        Relationships: [];
      };

      wallet_balances: {
        Row: { bucket: WalletBucket; balance: number; updated_at: string };
        Insert: { bucket: WalletBucket; balance?: number };
        Update: never; // always changed via wallet_transactions, never directly
        Relationships: [];
      };

      wallet_transactions: {
        Row: {
          id: string;
          bucket: WalletBucket;
          amount: number;
          reason: string | null;
          related_sale_id: string | null;
          legacy_raw: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bucket: WalletBucket;
          amount: number;
          reason?: string | null;
          related_sale_id?: string | null;
          legacy_raw?: Record<string, unknown> | null;
          created_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };

      closet_sections: {
        Row: {
          id: string;
          name: string;
          legacy_id: string | null;
          legacy_raw: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          legacy_id?: string | null;
          legacy_raw?: Record<string, unknown> | null;
          created_by?: string | null;
        };
        Update: Partial<{ name: string }>;
        Relationships: [];
      };

      closet_items: {
        Row: { id: string; closet_section_id: string; inventory_item_id: string; created_at: string };
        Insert: { id?: string; closet_section_id: string; inventory_item_id: string };
        Update: never;
        Relationships: [];
      };

      trades: {
        Row: {
          id: string;
          trade_date: string | null;
          received_name: string;
          kind: TradeKind;
          notes: string | null;
          selected_item_ids: string[];
          sold_item_ids: string[];
          active_item_id: string | null;
          legacy_id: string | null;
          legacy_raw: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trade_date?: string | null;
          received_name: string;
          kind?: TradeKind;
          notes?: string | null;
          selected_item_ids?: string[];
          sold_item_ids?: string[];
          active_item_id?: string | null;
          legacy_id?: string | null;
          legacy_raw?: Record<string, unknown> | null;
          created_by?: string | null;
        };
        Update: Partial<{ notes: string | null; sold_item_ids: string[]; active_item_id: string | null }>;
        Relationships: [];
      };
      platforms: {
        Row: { slug: string; name: string; is_active: boolean; created_at: string };
        Insert: { slug: string; name: string; is_active?: boolean };
        Update: Partial<{ name: string; is_active: boolean }>;
        Relationships: [];
      };
      item_postings: {
        Row: { id: string; inventory_item_id: string; platform_slug: string; status: PostingStatus; posting_account_id: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; inventory_item_id: string; platform_slug: string; status?: PostingStatus; posting_account_id?: string | null };
        Update: Partial<{ status: PostingStatus; posting_account_id: string | null }>;
        Relationships: [];
      };
    };

    Views: {
      inventory_items_secure: {
        Row: Database["public"]["Tables"]["inventory_items"]["Row"];
        Relationships: [];
      };
      sales_secure: {
        Row: Pick<
          Database["public"]["Tables"]["sales"]["Row"],
          | "id"
          | "inventory_item_id"
          | "sold_price"
          | "sale_date"
          | "sale_platform"
          | "buyer_note"
          | "marketplace_account_id"
          | "legacy_id"
          | "created_by"
          | "created_at"
          | "updated_at"
        >;
        Relationships: [];
      };
      marketplace_accounts_secure: {
        Row: Omit<Database["public"]["Tables"]["marketplace_accounts"]["Row"], "legacy_raw">;
        Relationships: [];
      };
    };

    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      claim_admin_role: { Args: { input_code: string }; Returns: boolean };
      ensure_monthly_chapter: { Args: { p_now?: string }; Returns: Database["public"]["Tables"]["chapters"]["Row"] };
      delete_chapter_safely: { Args: { p_chapter_id: string; p_move_packages_to?: string | null }; Returns: undefined };
      return_sale: { Args: { p_sale_id: string; p_received_name: string; p_date?: string }; Returns: string };
      undo_latest_action: { Args: Record<string, never>; Returns: string };
      account_owners: { Args: Record<string, never>; Returns: { id: string; full_name: string }[] };
    };
  };
}
