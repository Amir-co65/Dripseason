import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/services/platforms";
import type { Database } from "@/types/database.types";

export function usePlatforms(includeInactive = false) { return useQuery({ queryKey: ["platforms", includeInactive ? "all" : "active"], queryFn: () => api.listPlatforms(includeInactive) }); }
export function useItemPostings(itemIds?: string[]) { return useQuery({ queryKey: ["itemPostings", itemIds?.join(",") ?? "all"], queryFn: () => api.listItemPostings(itemIds) }); }
export function useCreatePlatform() { const qc = useQueryClient(); return useMutation({ mutationFn: api.createPlatform, onSuccess: () => qc.invalidateQueries({ queryKey: ["platforms"] }) }); }
export function useSetItemPosting() { const qc = useQueryClient(); return useMutation({ mutationFn: api.setItemPosting, onSuccess: () => qc.invalidateQueries({ queryKey: ["itemPostings"] }) }); }
export function useSetItemPostingsBulk() { const qc = useQueryClient(); return useMutation({ mutationFn: api.setItemPostingsBulk, onSuccess: () => qc.invalidateQueries({ queryKey: ["itemPostings"] }) }); }
export function useUpdatePlatform() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ slug, input }: { slug: string; input: Database["public"]["Tables"]["platforms"]["Update"] }) => api.updatePlatform(slug, input), onSuccess: () => qc.invalidateQueries({ queryKey: ["platforms"] }) }); }
