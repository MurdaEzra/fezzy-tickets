-- Allow the browser Supabase client to reach public read endpoints.
-- RLS policies still decide which rows are visible.
grant usage on schema public to anon, authenticated;

grant select on public.events to anon, authenticated;
grant select on public.ticket_tiers to anon, authenticated;
grant select on public.organizer_profiles to anon, authenticated;

