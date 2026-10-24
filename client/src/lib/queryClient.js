import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes: cache fresh data to avoid redundant refetches
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
