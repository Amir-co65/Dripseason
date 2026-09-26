import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as salesApi from "@/services/sales";
import type { ListSalesFilters } from "@/services/sales";

export function useSales(filters: ListSalesFilters = {}) {
  return useQuery({ queryKey: ["sales", filters], queryFn: () => salesApi.listSales(filters) });
}

export function useRecordSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesApi.recordSale,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventoryItems"] });
      qc.invalidateQueries({ queryKey: ["marketplaceAccounts"] });
      qc.invalidateQueries({ queryKey: ["walletBalances"] });
      qc.invalidateQueries({ queryKey: ["walletTransactions"] });
    },
  });
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: import("@/types/database.types").Database["public"]["Tables"]["sales"]["Update"] }) =>
      salesApi.updateSale(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventoryItems"] });
      qc.invalidateQueries({ queryKey: ["marketplaceAccounts"] });
      qc.invalidateQueries({ queryKey: ["walletBalances"] });
      qc.invalidateQueries({ queryKey: ["walletTransactions"] });
    },
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesApi.deleteSale,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventoryItems"] });
      qc.invalidateQueries({ queryKey: ["marketplaceAccounts"] });
      qc.invalidateQueries({ queryKey: ["walletBalances"] });
      qc.invalidateQueries({ queryKey: ["walletTransactions"] });
    },
  });
}
