import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type TradeInsert = Database["public"]["Tables"]["trades"]["Insert"];
type TradeUpdate = Database["public"]["Tables"]["trades"]["Update"];

export async function listTrades() {
  const { data, error } = await supabase.from("trades").select("*").order("trade_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTrade(input: TradeInsert) {
  const { data, error } = await supabase.from("trades").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateTrade(id: string, input: TradeUpdate) {
  const { data, error } = await supabase.from("trades").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTrade(id: string) {
  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw error;
}
