import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // data is considered "fresh" for 30s before refetching
      retry: 1,
    },
  },
});
