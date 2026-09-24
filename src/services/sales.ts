import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type SaleInsert = Database["public"]["Tables"]["sales"]["Insert"];
type SaleUpdate = Database["public"]["Tables"]["sales"]["Update"];

export interface ListSalesFilters {
  platform?: string;
  fromDate?: string;
  toDate?: string;
}

/** Reads from sales_secure, so sold_price comes back null for workers -
 * see the note in services/inventory.ts, same reasoning applies here. */
export async function listSales(filters: ListSalesFilters = {}) {
  // Supabase/PostgREST caps a response at the project's max_rows setting
  // (commonly 1,000). Read explicit pages so the Sold page can show every
  // matching row, including imports larger than that cap.
  const pageSize = 500;
  const allSales: NonNullable<Awaited<ReturnType<typeof fetchSalesPage>>> = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchSalesPage(filters, offset, pageSize);
    allSales.push(...page);
    if (page.length < pageSize) return allSales;
  }
}

async function fetchSalesPage(filters: ListSalesFilters, offset: number, pageSize: number) {
  let query = supabase
    .from("sales_secure")
    .select("*, inventory_item:inventory_item_id(item_name, legacy_public_id, category)")
    .order("sale_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (filters.platform) query = query.eq("sale_platform", filters.platform);
  if (filters.fromDate) query = query.gte("sale_date", filters.fromDate);
  if (filters.toDate) query = query.lte("sale_date", filters.toDate);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Records a sale. This single insert is what triggers
 * sync_inventory_item_on_sale() in the database, automatically flipping
 * the item's status to 'sold' - the app doesn't need to separately update
 * the item afterwards.
 */
export async function recordSale(input: SaleInsert) {
  const { data, error } = await supabase.from("sales").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateSale(id: string, input: SaleUpdate) {
  const { data, error } = await supabase.from("sales").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** The "unsell" action - deleting the sale row reverts the item's status
 * back to 'available' automatically, via the same database trigger.
 * Admin-only at the RLS layer (see migration 0013). */
export async function deleteSale(id: string) {
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw error;
}
