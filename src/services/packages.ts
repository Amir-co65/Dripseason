import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type PackageInsert = Database["public"]["Tables"]["packages"]["Insert"];
type PackageUpdate = Database["public"]["Tables"]["packages"]["Update"];

export async function listPackages(chapterId?: string) {
  let query = supabase.from("packages").select("*").order("package_number", { ascending: false, nullsFirst: false });
  if (chapterId) query = query.eq("chapter_id", chapterId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getPackage(id: string) {
  const { data, error } = await supabase.from("packages").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createPackage(input: PackageInsert) {
  const { data, error } = await supabase.from("packages").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updatePackage(id: string, input: PackageUpdate) {
  const { data, error } = await supabase.from("packages").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePackage(id: string) {
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;
}
