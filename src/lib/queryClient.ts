import { QueryClient } from "@tanstack/react-query";

export const CACHE_STALE_MS = 5 * 60 * 1000;
export const CACHE_GC_MS = 30 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: CACHE_STALE_MS,
      gcTime: CACHE_GC_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  events: {
    all: (opts?: { stream?: boolean; limit?: number }) =>
      ["events", "all", opts ?? {}] as const,
    published: (opts?: { stream?: boolean; limit?: number }) =>
      ["events", "published", opts ?? {}] as const,
    featured: (limit: number) => ["events", "featured", limit] as const,
    detail: (slug: string) => ["events", "detail", slug] as const,
    tiers: (eventId: string) => ["events", "tiers", eventId] as const,
    related: (category: string | null, excludeId: string) =>
      ["events", "related", category, excludeId] as const,
    categories: ["events", "categories"] as const,
  },
  organizer: {
    profile: (id: string) => ["organizer", "profile", id] as const,
  },
  profile: {
    user: (userId: string) => ["profile", userId] as const,
  },
  logs: {
    all: ["platform", "logs"] as const,
  },
};
