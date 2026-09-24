import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as closetApi from "@/services/closet";
import type { Database } from "@/types/database.types";

export function useClosetSections() {
  return useQuery({ queryKey: ["closetSections"], queryFn: closetApi.listClosetSections });
}

export function useItemsInSection(sectionId: string | undefined) {
  return useQuery({
    queryKey: ["closetItems", sectionId],
    queryFn: () => closetApi.listItemsInSection(sectionId as string),
    enabled: !!sectionId,
  });
}

export function useCreateClosetSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closetApi.createClosetSection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closetSections"] }),
  });
}

export function useUpdateClosetSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Database["public"]["Tables"]["closet_sections"]["Update"] }) =>
      closetApi.updateClosetSection(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closetSections"] }),
  });
}

export function useDeleteClosetSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closetApi.deleteClosetSection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closetSections"] }),
  });
}

export function useAssignItemToSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, inventoryItemId }: { sectionId: string; inventoryItemId: string }) =>
      closetApi.assignItemToSection(sectionId, inventoryItemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closetItems"] }),
  });
}

export function useRemoveItemFromSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closetApi.removeItemFromSection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closetItems"] }),
  });
}
