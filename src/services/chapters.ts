import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type ChapterInsert = Database["public"]["Tables"]["chapters"]["Insert"];
type ChapterUpdate = Database["public"]["Tables"]["chapters"]["Update"];

export async function listChapters() {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .order("chapter_number", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function createChapter(input: ChapterInsert) {
  const { data, error } = await supabase.from("chapters").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateChapter(id: string, input: ChapterUpdate) {
  const { data, error } = await supabase.from("chapters").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteChapter(id: string) {
  const { error } = await supabase.from("chapters").delete().eq("id", id);
  if (error) throw error;
}
