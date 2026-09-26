import { supabase } from "@/lib/supabase";
export async function undoLatestAction() { const { data, error } = await supabase.rpc("undo_latest_action"); if (error) throw error; return data; }
