import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Revalidate stale queries on mount while rendering cached data immediately
      gcTime: 1000 * 60 * 10, // 10 minutes: keep unused queries in cache before garbage collection
      retry: (failureCount, error) => {
        // Do not retry 4xx errors (unauthorized, not found, validation error)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Prevent jarring refetches on window focus
    },
    mutations: {
      retry: 0,
    },
  },
});
