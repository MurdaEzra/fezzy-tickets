
-- Allow anyone to see tickets that are in active resale listings
CREATE POLICY "Everyone can see tickets in active resale listings"
    ON public.tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.ticket_resale_listings trl
            WHERE trl.ticket_id = public.tickets.id
              AND trl.status = 'active'
        )
        -- Keep the existing permissions too!
        OR order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
        OR event_id IN (
            SELECT e.id FROM public.events e
            JOIN public.organizer_profiles op ON op.id = e.organizer_id
            WHERE op.user_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin')
    );

-- Drop the old ticket SELECT policy (we'll replace it with the combined one above)
DROP POLICY IF EXISTS "View tickets in own orders or own events" ON public.tickets;

