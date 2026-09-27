import { supabase } from "@/lib/supabase";
import type { Database, InventoryStatus } from "@/types/database.types";

type ItemInsert = Database["public"]["Tables"]["inventory_items"]["Insert"];
type ItemUpdate = Database["public"]["Tables"]["inventory_items"]["Update"];

/**
 * All READS go through inventory_items_secure (see migration 0014/0017).
 * That view returns real numbers for admins and null for purchase_price /
 * sold_price when the caller is a worker - evaluated fresh per request
 * using whoever is actually logged in, so this one function is correct
 * for both roles automatically. Nothing in this file needs an "if admin"
 * branch.
 */
export interface ListInventoryFilters {
  status?: InventoryStatus;
  category?: string;
  packageId?: string;
  hasPackage?: boolean;
  search?: string;
}

const migrationOnlyPrefixes = ["sold-sheet:", "media-only:"];

function isMigrationOnlyItem(item: { legacy_id: string | null }) {
  return migrationOnlyPrefixes.some((prefix) => item.legacy_id?.startsWith(prefix));
}

export async function listInventoryItems(filters: ListInventoryFilters = {}) {
  // Newest first across every page that consumes the shared inventory list.
  // ID is a deterministic tie-breaker for records created in the same batch.
  // Fetch pages explicitly; PostgREST otherwise silently caps this query at
  // the project row limit (1,000). Exclude importer-only surrogate rows after
  // each response while continuing based on the raw response size.
  const pageSize = 500;
  const items: Awaited<ReturnType<typeof fetchInventoryPage>> = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchInventoryPage(filters, offset, pageSize);
    items.push(...page.filter((item) => !isMigrationOnlyItem(item)));
    if (page.length < pageSize) return items;
  }
}

async function fetchInventoryPage(filters: ListInventoryFilters, offset: number, pageSize: number) {
  let query = supabase.from("inventory_items_secure").select("*")
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.packageId) query = query.eq("package_id", filters.packageId);
  if (filters.hasPackage) query = query.not("package_id", "is", null);
  if (filters.search) query = query.or(`item_name.ilike.%${filters.search}%,legacy_public_id.ilike.%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getInventoryItem(id: string) {
  const { data, error } = await supabase.from("inventory_items_secure").select("*").eq("id", id).single();
  if (error) throw error;
  if (isMigrationOnlyItem(data)) throw new Error("Inventory item not found.");
  return data;
}

/** WRITES go through the real table, never the view (the view can't be
 * written to because of its CASE-masked columns). RLS on the base table
 * still applies normally. */
export async function createInventoryItem(input: ItemInsert) {
  // The database assigns legacy_public_id in the same transaction as the
  // insert. Doing this in the browser can miss rows past PostgREST's page
  // limit and allows two simultaneous saves to pick the same ID.
  const { data, error } = await supabase.from("inventory_items").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateInventoryItem(id: string, input: ItemUpdate) {
  const { data, error } = await supabase.from("inventory_items").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInventoryItem(id: string) {
  // Archive instead of hard deleting: it disappears from all stock searches
  // and can be restored by Undo without losing photos, sales, or placement.
  const { error } = await supabase.from("inventory_items").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Every distinct category currently in use, for filter dropdowns. Reads
 * from the secure view too, though category was never masked. */
export async function listDistinctCategories(): Promise<string[]> {
  const categories: string[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("inventory_items_secure").select("category, legacy_id")
      .not("category", "is", null).order("id", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      const value = row.category;
      if (value && !isMigrationOnlyItem(row)) categories.push(value);
    }
    if (!data || data.length < pageSize) break;
  }
  return [...new Set(categories)].sort();
}
