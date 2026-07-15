-- This policy is redundant (marketplace uses a security definer view) and causes a massive data leak for authenticated users fetching their personal tickets.
DROP POLICY IF EXISTS "Everyone can see tickets in active resale listings" ON public.tickets;
