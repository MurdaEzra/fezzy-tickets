-- Redefine public.ticket_resale_listings_public to use the default security definer mode (security_invoker = off)
-- This allows roles like anon to query the view (safe, limited columns) without requiring SELECT permission on raw tickets table.

DROP VIEW IF EXISTS public.ticket_resale_listings_public;

CREATE OR REPLACE VIEW public.ticket_resale_listings_public
WITH (security_invoker = off) AS
SELECT
  l.id                   AS listing_id,
  l.resale_price_kes,
  l.listed_at,
  l.status,
  tt.name                AS tier_name,
  tt.price_kes           AS original_price_kes,
  e.id                   AS event_id,
  e.slug                 AS event_slug,
  e.title                AS event_title,
  e.starts_at            AS event_starts_at,
  e.venue_name           AS event_venue_name,
  e.city                 AS event_city,
  e.poster_url           AS event_poster_url,
  e.cover_image_url      AS event_cover_image_url
FROM public.ticket_resale_listings l
JOIN public.tickets t       ON t.id = l.ticket_id
JOIN public.ticket_tiers tt ON tt.id = t.tier_id
JOIN public.events e        ON e.id = l.event_id
WHERE l.status = 'active'
  AND e.status = 'published'
  AND (e.starts_at IS NULL OR e.starts_at > now());

ALTER VIEW public.ticket_resale_listings_public OWNER TO postgres;

GRANT SELECT ON public.ticket_resale_listings_public TO anon, authenticated;
