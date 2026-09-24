import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as walletApi from "@/services/wallet";
import type { WalletBucket } from "@/types/database.types";

export function useWalletBalances() {
  return useQuery({ queryKey: ["walletBalances"], queryFn: walletApi.listWalletBalances });
}

export function useWalletTransactions(bucket?: WalletBucket) {
  return useQuery({
    queryKey: ["walletTransactions", bucket ?? "all"],
    queryFn: () => walletApi.listWalletTransactions(bucket),
  });
}

export function useAddWalletTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: walletApi.addWalletTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walletBalances"] });
      qc.invalidateQueries({ queryKey: ["walletTransactions"] });
    },
  });
}
