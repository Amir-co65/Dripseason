import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as chaptersApi from "@/services/chapters";
import * as packagesApi from "@/services/packages";
import type { Database } from "@/types/database.types";

export function useChapters() {
  return useQuery({ queryKey: ["chapters"], queryFn: chaptersApi.listChapters });
}

export function useCreateChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chaptersApi.createChapter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters"] }),
  });
}

export function useUpdateChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Database["public"]["Tables"]["chapters"]["Update"] }) =>
      chaptersApi.updateChapter(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters"] }),
  });
}

export function useDeleteChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chaptersApi.deleteChapter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapters"] });
      qc.invalidateQueries({ queryKey: ["packages"] });
    },
  });
}

export function usePackages(chapterId?: string) {
  return useQuery({ queryKey: ["packages", chapterId ?? "all"], queryFn: () => packagesApi.listPackages(chapterId) });
}

export function usePackage(id: string | undefined) {
  return useQuery({ queryKey: ["packages", "one", id], queryFn: () => packagesApi.getPackage(id as string), enabled: !!id });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: packagesApi.createPackage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packages"] });
      qc.invalidateQueries({ queryKey: ["chapters"] });
    },
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Database["public"]["Tables"]["packages"]["Update"] }) =>
      packagesApi.updatePackage(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: packagesApi.deletePackage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packages"] });
      qc.invalidateQueries({ queryKey: ["inventoryItems"] });
    },
  });
}
