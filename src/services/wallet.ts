import { supabase } from "@/lib/supabase";
import type { Database, WalletBucket } from "@/types/database.types";

type TransactionInsert = Database["public"]["Tables"]["wallet_transactions"]["Insert"];

/** Admin-only via RLS (migration 0018) - this whole file only ever
 * succeeds for an admin session. */
export async function listWalletBalances() {
  const { data, error } = await supabase.from("wallet_balances").select("*").order("bucket");
  if (error) throw error;
  return data;
}

export async function listWalletTransactions(bucket?: WalletBucket) {
  let query = supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(200);
  if (bucket) query = query.eq("bucket", bucket);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * The only way balances ever change: insert a transaction (positive amount
 * = deposit, negative = withdrawal). A database trigger applies it to
 * wallet_balances automatically - there's no separate "update balance"
 * function, on purpose, so the balance can never drift from its history.
 */
export async function addWalletTransaction(input: TransactionInsert) {
  const { data, error } = await supabase.from("wallet_transactions").insert(input).select().single();
  if (error) throw error;
  return data;
}
