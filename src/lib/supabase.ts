import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly and immediately at startup rather than with a confusing
  // error later, if someone forgot to create their .env file.
  throw new Error(
    "Missing Supabase environment variables. Copy .env.example to .env and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings."
  );
}

// This is the ONE client the whole app shares. It only ever holds the
// "anon" public key - safe to ship to the browser, because every table it
// touches is protected by the Row Level Security policies we wrote in SQL.
// The anon key alone can't do anything RLS doesn't allow.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
