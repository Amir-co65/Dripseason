import { useMutation, useQueryClient } from "@tanstack/react-query";
import { undoLatestAction } from "@/services/undo";
export function useUndo() { const qc = useQueryClient(); return useMutation({ mutationFn: undoLatestAction, onSuccess: () => qc.invalidateQueries() }); }
