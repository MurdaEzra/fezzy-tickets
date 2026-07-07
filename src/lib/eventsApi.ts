// @ts-nocheck
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
  event_dates: string[];
  lineup: string[];
  is_stream: boolean;
  stream_url: string | null;
  status: "draft" | "pending_approval" | "published" | "cancelled" | "completed";
  fee_waived: boolean;
  resale_enabled?: boolean;
  min_resale_percentage?: number;
  max_resale_percentage?: number;
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
  valid_dates: string[];
};

export type DbOrganizer = {
  id: string;
  org_name: string;
  logo_url: string | null;
  website: string | null;
};

export type DbEventWithTiers = DbEvent & {
  ticket_tiers?: DbTier[];
};

export type AccountTicket = {
  id: string;
  status: "valid" | "used" | "refunded" | "cancelled";
  created_at: string;
  holder_name: string;
  events: DbEvent | null;
  ticket_tiers: DbTier | null;
  orders: {
    id: string;
    status: "pending" | "paid" | "failed" | "refunded";
    total_kes: number;
    payment_ref: string | null;
  } | null;
};

export const formatKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

export const formatPrice = (n: number) => formatKES(n);

export const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const formatEventDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const formatEventTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export async function fetchAllEventsWithTiers(opts: { stream?: boolean; limit?: number } = {}) {
  let q = supabase
    .from("events")
    .select("*, ticket_tiers(*)")
    .order("starts_at", { ascending: true })
    .order("sort_order", { referencedTable: "ticket_tiers", ascending: true });
  if (opts.stream !== undefined) q = q.eq("is_stream", opts.stream);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DbEventWithTiers[];
}

export async function fetchPublishedEvents(opts: { stream?: boolean; limit?: number } = {}) {
  let q = supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (opts.stream !== undefined) q = q.eq("is_stream", opts.stream);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function fetchPublishedEventsWithTiers(opts: { stream?: boolean; limit?: number } = {}) {
  let q = supabase
    .from("events")
    .select("*, ticket_tiers(*)")
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .order("sort_order", { referencedTable: "ticket_tiers", ascending: true });
  if (opts.stream !== undefined) q = q.eq("is_stream", opts.stream);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DbEventWithTiers[];
}

export async function fetchEventBySlug(slug: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
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

export async function fetchRelatedEvents(category: string | null, excludeId: string, limit = 3) {
  if (!category) return [];
  const { data, error } = await supabase
    .from("events")
    .select("*, ticket_tiers(*)")
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .eq("category", category)
    .neq("id", excludeId)
    .order("starts_at", { ascending: true })
    .order("sort_order", { referencedTable: "ticket_tiers", ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DbEventWithTiers[];
}

export async function fetchOrganizerProfile(id: string) {
  const { data, error } = await supabase
    .from("organizer_profiles")
    .select("id, org_name, logo_url, website, contact_email, contact_phone, bio, events_published_count")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAccountTickets() {
  const { data, error } = await supabase
    .from("tickets")
    .select("id, status, created_at, holder_name, events(*), ticket_tiers(*), orders(id, status, total_kes, payment_ref)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccountTicket[];
}

export function lowestTierPrice(tiers: DbTier[] | undefined) {
  if (!tiers?.length) return null;
  return Math.min(...tiers.map((tier) => tier.price_kes));
}

export function ticketsRemaining(tier: DbTier) {
  return Math.max(0, tier.quantity - tier.sold);
}
