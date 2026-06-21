import { supabase } from "@/integrations/supabase/client";
import type { DbEventWithTiers } from "@/lib/eventsApi";

export type Artist = {
  name: string;
  genre: string;
  shows: string;
  image: string;
};

export type IconicVenue = {
  name: string;
  city: string;
  events: string;
  image: string;
};

export type HomepageSettings = {
  live_bar_items: string[];
  headliner_event_id: string | null;
  trending_event_ids: string[];
  calendar_event_ids: string[];
  artists: Artist[];
  iconic_venues: IconicVenue[];
  updated_at?: string;
};

export const defaultLiveBarItems = [
  "Sol Fest tickets now live - Early Bird ends in 4 days",
  "Use code FEZZY25 for 15% off your first purchase",
  "Now serving Nairobi, Mombasa, Kisumu, Nakuru and Eldoret",
];

export async function fetchHomepageSettings(): Promise<HomepageSettings> {
  const { data, error } = await (supabase as any)
    .from("homepage_settings")
    .select("live_bar_items, headliner_event_id, trending_event_ids, calendar_event_ids, artists, iconic_venues, updated_at")
    .eq("id", true)
    .maybeSingle();

  if (error) throw error;

  return {
    live_bar_items: data?.live_bar_items?.length ? data.live_bar_items : defaultLiveBarItems,
    headliner_event_id: data?.headliner_event_id ?? null,
    trending_event_ids: data?.trending_event_ids ?? [],
    calendar_event_ids: data?.calendar_event_ids ?? [],
    artists: data?.artists ?? [],
    iconic_venues: data?.iconic_venues ?? [],
    updated_at: data?.updated_at,
  };
}

export async function updateHomepageSettings(input: HomepageSettings & { updated_by?: string | null }) {
  const payload = {
    id: true,
    live_bar_items: input.live_bar_items.map((item) => item.trim()).filter(Boolean),
    headliner_event_id: input.headliner_event_id,
    trending_event_ids: input.trending_event_ids,
    calendar_event_ids: input.calendar_event_ids,
    artists: input.artists,
    iconic_venues: input.iconic_venues,
    updated_by: input.updated_by ?? null,
  };

  const { data, error } = await (supabase as any)
    .from("homepage_settings")
    .upsert(payload, { onConflict: "id" })
    .select("live_bar_items, headliner_event_id, trending_event_ids, calendar_event_ids, artists, iconic_venues, updated_at")
    .single();

  if (error) throw error;
  return data as HomepageSettings;
}

export function pickHeadliner(events: DbEventWithTiers[], headlinerEventId?: string | null) {
  return events.find((event) => event.id === headlinerEventId) ?? events[0] ?? null;
}
