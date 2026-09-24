import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as tradesApi from "@/services/trades";
import type { Database } from "@/types/database.types";

export function useTrades() {
  return useQuery({ queryKey: ["trades"], queryFn: tradesApi.listTrades });
}

export function useCreateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tradesApi.createTrade,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades"] }),
  });
}

export function useUpdateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Database["public"]["Tables"]["trades"]["Update"] }) =>
      tradesApi.updateTrade(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades"] }),
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tradesApi.deleteTrade,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades"] }),
  });
}
