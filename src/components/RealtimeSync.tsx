import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const QUERY_KEYS = ["chapters", "packages", "inventoryItems", "inventoryCategories", "itemMedia", "sales", "marketplaceAccounts", "postingAccounts", "walletBalances", "walletTransactions", "closetSections", "closetItems", "trades"];

export function RealtimeSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel("project26-live").on("postgres_changes", { event: "*", schema: "public" }, () => {
      for (const key of QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
  return null;
}
