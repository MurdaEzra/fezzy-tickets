-- Update ticket RLS policies to fallback to matching auth JWT email for guest checkouts

-- 1. public.tickets
DROP POLICY IF EXISTS "Owners, organizers and admins can view tickets" ON public.tickets;
CREATE POLICY "Owners, organizers and admins can view tickets"
  ON public.tickets FOR SELECT
  USING (
    current_owner_user_id = auth.uid()
    OR (
      current_owner_user_id IS NULL
      AND order_id IN (
        SELECT id FROM public.orders 
        WHERE user_id = auth.uid() OR guest_email = (auth.jwt()->>'email')
      )
    )
    OR holder_email = (auth.jwt()->>'email')
    OR event_id IN (
      SELECT e.id FROM public.events e
      JOIN public.organizer_profiles op ON op.id = e.organizer_id
      WHERE op.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- 2. public.ticket_qr_versions
DROP POLICY IF EXISTS "Users can view active QR versions for their tickets" ON public.ticket_qr_versions;
CREATE POLICY "Users can view active QR versions for their tickets"
  ON public.ticket_qr_versions FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_qr_versions.ticket_id
        AND (
          t.current_owner_user_id = auth.uid()
          OR t.holder_email = (auth.jwt()->>'email')
          OR (
            t.current_owner_user_id IS NULL
            AND t.order_id IN (
              SELECT id FROM public.orders 
              WHERE user_id = auth.uid() OR guest_email = (auth.jwt()->>'email')
            )
          )
        )
    )
  );

-- 3. public.ticket_activity_logs
DROP POLICY IF EXISTS "Users can view activity logs for their tickets" ON public.ticket_activity_logs;
CREATE POLICY "Users can view activity logs for their tickets"
  ON public.ticket_activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_activity_logs.ticket_id
        AND (
          t.current_owner_user_id = auth.uid()
          OR t.holder_email = (auth.jwt()->>'email')
          OR (
            t.current_owner_user_id IS NULL
            AND t.order_id IN (
              SELECT id FROM public.orders 
              WHERE user_id = auth.uid() OR guest_email = (auth.jwt()->>'email')
            )
          )
        )
    )
  );

-- 4. public.ticket_resale_listings
DROP POLICY IF EXISTS "Owner can create resale listing" ON public.ticket_resale_listings;
CREATE POLICY "Owner can create resale listing"
  ON public.ticket_resale_listings FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.current_owner_user_id = auth.uid()
          OR t.holder_email = (auth.jwt()->>'email')
          OR (
            t.current_owner_user_id IS NULL
            AND t.order_id IN (
              SELECT id FROM public.orders 
              WHERE user_id = auth.uid() OR guest_email = (auth.jwt()->>'email')
            )
          )
        )
    )
  );
