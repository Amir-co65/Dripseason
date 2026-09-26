import { supabase } from "@/lib/supabase";
import type { Database, Platform } from "@/types/database.types";

type AccountInsert = Database["public"]["Tables"]["marketplace_accounts"]["Insert"];
type AccountUpdate = Database["public"]["Tables"]["marketplace_accounts"]["Update"];
type PostingAccountInsert = Database["public"]["Tables"]["posting_accounts"]["Insert"];

/** Reads from marketplace_accounts_secure - password comes back null for
 * workers automatically (migration 0016). */
export async function listMarketplaceAccounts(platform?: Platform) {
  let query = supabase.from("marketplace_accounts_secure").select("*").order("platform").order("posting_account_number");
  if (platform) query = query.eq("platform", platform);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Admin-only at the RLS layer - a worker calling these gets a permission
 * error from Postgres itself, not just a hidden button in the UI. */
export async function createMarketplaceAccount(input: AccountInsert) {
  const { data, error } = await supabase.from("marketplace_accounts").insert(input).select("id, platform, label, posting_account_number, balance, banned, created_by, account_owner_id, created_at, updated_at").single();
  if (error) throw error;
  return data;
}

export async function updateMarketplaceAccount(id: string, input: AccountUpdate) {
  const { data, error } = await supabase.from("marketplace_accounts").update(input).eq("id", id).select("id, platform, label, posting_account_number, balance, banned, created_by, account_owner_id, created_at, updated_at").single();
  if (error) throw error;
  return data;
}

export async function deleteMarketplaceAccount(id: string) {
  const { error } = await supabase.from("marketplace_accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function listPostingAccounts(platform?: Platform) {
  let query = supabase.from("posting_accounts").select("*").order("platform").order("account_number");
  if (platform) query = query.eq("platform", platform);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createPostingAccount(input: PostingAccountInsert) {
  const { data, error } = await supabase.from("posting_accounts").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updatePostingAccount(id: string, input: Database["public"]["Tables"]["posting_accounts"]["Update"]) {
  const { data, error } = await supabase.from("posting_accounts").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePostingAccount(id: string) {
  const { error } = await supabase.from("posting_accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function listAccountOwners() {
  const { data, error } = await supabase.rpc("account_owners");
  if (error) throw error;
  return data ?? [];
}
