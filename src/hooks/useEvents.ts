import { useQuery } from "@tanstack/react-query";
import {
  fetchAllEventsWithTiers,
  fetchEventBySlug,
  fetchOrganizerProfile,
  fetchPublishedEventsWithTiers,
  fetchRelatedEvents,
  fetchTiers,
  type DbEventWithTiers,
} from "@/lib/eventsApi";
import { fetchHomepageSettings } from "@/lib/homepageSettings";
import { queryKeys } from "@/lib/queryClient";

export function useAllEvents(opts: { stream?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.events.all(opts),
    queryFn: () => fetchAllEventsWithTiers(opts),
  });
}

export function usePublishedEvents(opts: { stream?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.events.published(opts),
    queryFn: () => fetchPublishedEventsWithTiers(opts),
  });
}

export function useFeaturedEvents(limit = 6) {
  return useQuery({
    queryKey: queryKeys.events.featured(limit),
    queryFn: () => fetchPublishedEventsWithTiers({ limit }),
  });
}

export function useEventCategories() {
  return useQuery({
    queryKey: queryKeys.events.categories,
    queryFn: async () => {
      const events = await fetchPublishedEventsWithTiers();
      return Array.from(
        new Set(events.map((event) => event.category).filter(Boolean) as string[]),
      ).sort();
    },
  });
}

export function useEventDetail(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.detail(slug ?? ""),
    queryFn: () => fetchEventBySlug(slug!),
    enabled: !!slug,
  });
}

export function useEventTiers(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.tiers(eventId ?? ""),
    queryFn: () => fetchTiers(eventId!),
    enabled: !!eventId,
  });
}

export function useRelatedEvents(category: string | null | undefined, excludeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.related(category ?? null, excludeId ?? ""),
    queryFn: () => fetchRelatedEvents(category ?? null, excludeId!, 3),
    enabled: !!excludeId,
  });
}

export function useOrganizerProfile(organizerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizer.profile(organizerId ?? ""),
    queryFn: () => fetchOrganizerProfile(organizerId!),
    enabled: !!organizerId,
  });
}

export function useHomepageSettings() {
  return useQuery({
    queryKey: ["homepage-settings"],
    queryFn: fetchHomepageSettings,
  });
}

export function categoriesFromEvents(events: DbEventWithTiers[]) {
  return Array.from(
    new Set(events.map((event) => event.category).filter(Boolean) as string[]),
  ).sort();
}
