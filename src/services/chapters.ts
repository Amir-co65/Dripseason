import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type ChapterInsert = Database["public"]["Tables"]["chapters"]["Insert"];
type ChapterUpdate = Database["public"]["Tables"]["chapters"]["Update"];

// Pulls the first number found in the haul's name, e.g. "Chapter 16" -> 16
function extractHaulNumber(name: string | null | undefined): number {
  if (!name) return -Infinity; // unnumbered haul, put last in a descending sort
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : -Infinity;
}

export async function listChapters() {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  // Sort by the number parsed out of the name, descending (highest on top)
  const sorted = [...(data ?? [])].sort((a, b) => {
    const numA = extractHaulNumber(a.name);
    const numB = extractHaulNumber(b.name);
    return numB - numA;
  });

  return sorted;
}

export async function createChapter(input: ChapterInsert) {
  let chapterNumber = input.chapter_number;

  const parsedFromName = extractHaulNumber((input as { name?: string }).name);

  if (chapterNumber == null && Number.isFinite(parsedFromName)) {
    chapterNumber = parsedFromName;
  }

  if (chapterNumber == null) {
    const { data: latest, error: latestError } = await supabase
      .from("chapters")
      .select("chapter_number")
      .not("chapter_number", "is", null)
      .order("chapter_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    chapterNumber = (latest?.chapter_number ?? 0) + 1;
  }

  const { data, error } = await supabase.from("chapters").insert({ ...input, chapter_number: chapterNumber }).select().single();
  if (error) throw error;
  return data;
}

export async function updateChapter(id: string, input: ChapterUpdate) {
  const { data, error } = await supabase.from("chapters").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteChapter(id: string, movePackagesTo?: string | null) {
  const { error } = await supabase.rpc("delete_chapter_safely", { p_chapter_id: id, p_move_packages_to: movePackagesTo ?? null });
  if (error) throw error;
}

export async function ensureCurrentMonthlyChapter() {
  const { data, error } = await supabase.rpc("ensure_monthly_chapter", {});
  if (error) throw error;
  return data;
}