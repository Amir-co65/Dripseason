import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as inventoryApi from "@/services/inventory";
import * as mediaApi from "@/services/media";
import type { Database } from "@/types/database.types";
import type { ListInventoryFilters } from "@/services/inventory";
import { usePackages } from "@/hooks/useChapters";

export function useInventoryItems(filters: ListInventoryFilters = {}) {
  return useQuery({
    queryKey: ["inventoryItems", filters],
    queryFn: () => inventoryApi.listInventoryItems(filters),
  });
}

/** Inventory for operational pages, excluding items whose package is still inbound. */
export function useNonArrivingInventoryItems(filters: ListInventoryFilters = {}) {
  const inventory = useInventoryItems(filters);
  const packages = usePackages();
  const arrivingPackageIds = new Set((packages.data ?? []).filter((pack) => pack.arrival_status === "arriving").map((pack) => pack.id));
  return {
    ...inventory,
    data: inventory.data?.filter((item) => !packages.isError && (!item.package_id || !arrivingPackageIds.has(item.package_id))),
    isLoading: inventory.isLoading || packages.isLoading,
    isError: inventory.isError || packages.isError,
    error: inventory.error ?? packages.error,
  };
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: ["inventoryItems", "one", id],
    queryFn: () => inventoryApi.getInventoryItem(id as string),
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({ queryKey: ["inventoryCategories"], queryFn: inventoryApi.listDistinctCategories });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventoryItems"] }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Database["public"]["Tables"]["inventory_items"]["Update"] }) =>
      inventoryApi.updateInventoryItem(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventoryItems"] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.deleteInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventoryItems"] }),
  });
}

export function useItemMedia(inventoryItemId: string | undefined) {
  return useQuery({
    queryKey: ["itemMedia", inventoryItemId],
    queryFn: () => mediaApi.listItemMedia(inventoryItemId as string),
    enabled: !!inventoryItemId,
  });
}

export function useItemThumbnails(inventoryItemIds: string[]) {
  const ids = [...new Set(inventoryItemIds)].sort();
  return useQuery({
    queryKey: ["itemThumbnails", ids],
    queryFn: () => mediaApi.listItemThumbnailUrls(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadItemPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inventoryItemId, file, position }: { inventoryItemId: string; file: File; position?: number }) =>
      mediaApi.uploadItemPhoto(inventoryItemId, file, position),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["itemMedia", vars.inventoryItemId] }),
  });
}

export function useDeleteItemMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, storagePath }: { mediaId: string; storagePath?: string | null; inventoryItemId: string }) =>
      mediaApi.deleteItemMedia(mediaId, storagePath),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["itemMedia", vars.inventoryItemId] }),
  });
}

export function useAddItemLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inventoryItemId, url }: { inventoryItemId: string; url: string }) => mediaApi.addItemLink(inventoryItemId, url),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["itemMedia", vars.inventoryItemId] }),
  });
}
