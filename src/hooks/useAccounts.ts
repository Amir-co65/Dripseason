import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as accountsApi from "@/services/accounts";
import type { Database, Platform } from "@/types/database.types";

export function useMarketplaceAccounts(platform?: Platform) {
  return useQuery({
    queryKey: ["marketplaceAccounts", platform ?? "all"],
    queryFn: () => accountsApi.listMarketplaceAccounts(platform),
  });
}

export function useCreateMarketplaceAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.createMarketplaceAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketplaceAccounts"] }),
  });
}

export function useUpdateMarketplaceAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Database["public"]["Tables"]["marketplace_accounts"]["Update"] }) =>
      accountsApi.updateMarketplaceAccount(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketplaceAccounts"] }),
  });
}

export function useDeleteMarketplaceAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.deleteMarketplaceAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplaceAccounts"] });
      qc.invalidateQueries({ queryKey: ["postingAccounts"] });
    },
  });
}

export function usePostingAccounts(platform?: Platform) {
  return useQuery({
    queryKey: ["postingAccounts", platform ?? "all"],
    queryFn: () => accountsApi.listPostingAccounts(platform),
  });
}

export function useCreatePostingAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.createPostingAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["postingAccounts"] }),
  });
}

export function useUpdatePostingAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Database["public"]["Tables"]["posting_accounts"]["Update"] }) =>
      accountsApi.updatePostingAccount(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["postingAccounts"] }),
  });
}

export function useDeletePostingAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountsApi.deletePostingAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["postingAccounts"] });
      qc.invalidateQueries({ queryKey: ["inventoryItems"] });
    },
  });
}
