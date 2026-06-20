import { supabase } from "@/integrations/supabase/client";
import type { DbEventWithTiers } from "@/lib/eventsApi";

export type HomepageSettings = {
  live_bar_items: string[];
  headliner_event_id: string | null;
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
    .select("live_bar_items, headliner_event_id, updated_at")
    .eq("id", true)
    .maybeSingle();

  if (error) throw error;

  return {
    live_bar_items: data?.live_bar_items?.length ? data.live_bar_items : defaultLiveBarItems,
    headliner_event_id: data?.headliner_event_id ?? null,
    updated_at: data?.updated_at,
  };
}

export async function updateHomepageSettings(input: HomepageSettings & { updated_by?: string | null }) {
  const payload = {
    id: true,
    live_bar_items: input.live_bar_items.map((item) => item.trim()).filter(Boolean),
    headliner_event_id: input.headliner_event_id,
    updated_by: input.updated_by ?? null,
  };

  const { data, error } = await (supabase as any)
    .from("homepage_settings")
    .upsert(payload, { onConflict: "id" })
    .select("live_bar_items, headliner_event_id, updated_at")
    .single();

  if (error) throw error;
  return data as HomepageSettings;
}

export function pickHeadliner(events: DbEventWithTiers[], headlinerEventId?: string | null) {
  return events.find((event) => event.id === headlinerEventId) ?? events[0] ?? null;
}
