import { supabase } from "@/integrations/supabase/client";

export type DbEvent = {
  id: string;
  organizer_id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  poster_url: string | null;
  ticket_design: { theme?: string; accent?: string; pattern?: string };
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  starts_at: string;
  ends_at: string | null;
  is_stream: boolean;
  stream_url: string | null;
  status: "draft" | "published" | "cancelled" | "completed";
  fee_waived: boolean;
};

export type DbTier = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_kes: number;
  quantity: number;
  sold: number;
  sort_order: number;
};

export const formatKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

export const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const formatEventDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const formatEventTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export async function fetchPublishedEvents(opts: { stream?: boolean; limit?: number } = {}) {
  let q = supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("starts_at", { ascending: true });
  if (opts.stream !== undefined) q = q.eq("is_stream", opts.stream);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function fetchEventBySlug(slug: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as DbEvent | null;
}

export async function fetchTiers(eventId: string) {
  const { data, error } = await supabase
    .from("ticket_tiers")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbTier[];
}
