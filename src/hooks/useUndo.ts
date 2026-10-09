import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUndoCount, undoLatestAction } from "@/services/undo";
export function useUndo() {
  const qc = useQueryClient();
  const count = useQuery({ queryKey: ["undoCount"], queryFn: listUndoCount, refetchInterval: 30_000 });
  const mutation = useMutation({ mutationFn: undoLatestAction, onSuccess: () => qc.invalidateQueries() });
  return { ...mutation, count: count.data ?? 0 };
}
