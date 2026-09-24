import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type SectionInsert = Database["public"]["Tables"]["closet_sections"]["Insert"];
type SectionUpdate = Database["public"]["Tables"]["closet_sections"]["Update"];

export async function listClosetSections() {
  const { data, error } = await supabase.from("closet_sections").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function createClosetSection(input: SectionInsert) {
  const { data, error } = await supabase.from("closet_sections").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateClosetSection(id: string, input: SectionUpdate) {
  const { data, error } = await supabase.from("closet_sections").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClosetSection(id: string) {
  const { error } = await supabase.from("closet_sections").delete().eq("id", id);
  if (error) throw error;
}

/** Items currently placed in a given section, joined with their basic
 * inventory info for display. */
export async function listItemsInSection(sectionId: string) {
  const { data, error } = await supabase
    .from("closet_items")
    .select("id, inventory_item_id, inventory_items(item_name, legacy_public_id, status)")
    .eq("closet_section_id", sectionId);
  if (error) throw error;
  return data;
}

/** An item can only be in one section at a time (unique constraint on
 * inventory_item_id) - assigning it to a new section requires removing
 * any previous placement first. */
export async function assignItemToSection(sectionId: string, inventoryItemId: string) {
  await supabase.from("closet_items").delete().eq("inventory_item_id", inventoryItemId);
  const { data, error } = await supabase
    .from("closet_items")
    .insert({ closet_section_id: sectionId, inventory_item_id: inventoryItemId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeItemFromSection(closetItemId: string) {
  const { error } = await supabase.from("closet_items").delete().eq("id", closetItemId);
  if (error) throw error;
}
