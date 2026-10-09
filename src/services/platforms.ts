import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

export async function listPlatforms(includeInactive = false) {
  let query = supabase.from("platforms").select("*").order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createPlatform(input: Database["public"]["Tables"]["platforms"]["Insert"]) {
  const { data, error } = await supabase.from("platforms").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updatePlatform(slug: string, input: Database["public"]["Tables"]["platforms"]["Update"]) {
  const { data, error } = await supabase.from("platforms").update(input).eq("slug", slug).select().single();
  if (error) throw error;
  return data;
}

export async function listItemPostings(itemIds?: string[]) {
  let query = supabase.from("item_postings").select("*");
  if (itemIds?.length) query = query.in("inventory_item_id", itemIds);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function setItemPosting(input: Database["public"]["Tables"]["item_postings"]["Insert"]) {
  const { data, error } = await supabase.from("item_postings").upsert(input, { onConflict: "inventory_item_id,platform_slug" }).select().single();
  if (error) throw error;
  return data;
}
