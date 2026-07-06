
-- Grant SELECT access to anon for resale marketplace tables so everyone can view listings
GRANT SELECT ON public.ticket_resale_listings TO anon, authenticated;
-- Also ensure tickets, ticket_tiers, and events are accessible (already granted but just in case)
GRANT SELECT ON public.tickets TO anon, authenticated;

