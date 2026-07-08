ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS resale_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_resale_percentage integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS max_resale_percentage integer NOT NULL DEFAULT 120;

-- Tickets: ownership + credential rotation support
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS current_owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_token_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Backfill current owner from the original order.
UPDATE public.tickets t
   SET current_owner_user_id = o.user_id
  FROM public.orders o
 WHERE t.order_id = o.id
   AND t.current_owner_user_id IS NULL
   AND o.user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_current_owner ON public.tickets(current_owner_user_id);

-- Broaden owner-facing SELECT to include current_owner_user_id (post-resale buyers).
DROP POLICY IF EXISTS "View tickets in own orders or own events" ON public.tickets;
CREATE POLICY "Owners, organizers and admins can view tickets"
  ON public.tickets FOR SELECT
  USING (
    current_owner_user_id = auth.uid()
    OR order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
    OR event_id IN (
      SELECT e.id FROM public.events e
      JOIN public.organizer_profiles op ON op.id = e.organizer_id
      WHERE op.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Explicitly ensure no anon grant lingers on tickets.
REVOKE SELECT ON public.tickets FROM anon;

-- =============================================================================
-- Resale listings
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.resale_listing_status AS ENUM
    ('active', 'pending_payment', 'sold', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ticket_resale_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resale_price_kes integer NOT NULL CHECK (resale_price_kes > 0),
  status public.resale_listing_status NOT NULL DEFAULT 'active',
  payment_expires_at timestamptz,
  payment_ref text,
  listed_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One active-ish listing per ticket at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_listing_per_ticket
  ON public.ticket_resale_listings(ticket_id)
  WHERE status IN ('active', 'pending_payment');

CREATE INDEX IF NOT EXISTS idx_resale_status ON public.ticket_resale_listings(status);
CREATE INDEX IF NOT EXISTS idx_resale_event ON public.ticket_resale_listings(event_id);
CREATE INDEX IF NOT EXISTS idx_resale_seller ON public.ticket_resale_listings(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_resale_buyer ON public.ticket_resale_listings(buyer_user_id);

GRANT SELECT, INSERT, UPDATE ON public.ticket_resale_listings TO authenticated;
GRANT ALL ON public.ticket_resale_listings TO service_role;
-- Deliberately NO grant to anon on the base table. Anon browses via the view below.

ALTER TABLE public.ticket_resale_listings ENABLE ROW LEVEL SECURITY;

-- Seller can see their own listings; matched buyer can see once assigned; admin sees all.
CREATE POLICY "Resale listings visible to seller/buyer/admin"
  ON public.ticket_resale_listings FOR SELECT
  TO authenticated
  USING (
    seller_user_id = auth.uid()
    OR buyer_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Only the ticket owner can create a listing for their own ticket.
CREATE POLICY "Owner can create resale listing"
  ON public.ticket_resale_listings FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (t.current_owner_user_id = auth.uid()
             OR t.order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()))
    )
  );

-- Seller can cancel their own listing (RPCs handle status transitions to sold/pending_payment).
CREATE POLICY "Seller can update own listing"
  ON public.ticket_resale_listings FOR UPDATE
  TO authenticated
  USING (seller_user_id = auth.uid())
  WITH CHECK (seller_user_id = auth.uid());

CREATE TRIGGER trg_resale_listings_updated_at
  BEFORE UPDATE ON public.ticket_resale_listings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Status transition guard: only forward transitions.
CREATE OR REPLACE FUNCTION public.enforce_resale_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'active'          AND NEW.status IN ('pending_payment','cancelled','expired'))
      OR (OLD.status = 'pending_payment' AND NEW.status IN ('sold','active','expired','cancelled'))
      OR (OLD.status = 'active'          AND NEW.status = 'sold' AND current_setting('app.allow_direct_sold', true) = 'on')
    ) THEN
      RAISE EXCEPTION 'Illegal resale listing status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resale_status_transition
  BEFORE UPDATE ON public.ticket_resale_listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_resale_status_transition();

-- =============================================================================
-- Resale transfers audit log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.resale_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ticket_resale_listings(id) ON DELETE RESTRICT,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE RESTRICT,
  seller_user_id uuid NOT NULL,
  buyer_user_id uuid NOT NULL,
  sale_price_kes integer NOT NULL,
  payment_ref text,
  payment_provider text,
  previous_qr_token_hash text NOT NULL, -- sha256 hex, never plaintext
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resale_transfers_ticket ON public.resale_transfers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_resale_transfers_buyer ON public.resale_transfers(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_resale_transfers_seller ON public.resale_transfers(seller_user_id);

GRANT SELECT ON public.resale_transfers TO authenticated;
GRANT ALL ON public.resale_transfers TO service_role;

ALTER TABLE public.resale_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transfer audit visible to participants and admin"
  ON public.resale_transfers FOR SELECT
  TO authenticated
  USING (
    seller_user_id = auth.uid()
    OR buyer_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- =============================================================================
-- PUBLIC MARKETPLACE VIEW — safe for anonymous browsing
-- Structurally excludes qr_token, holder_name, holder_email, buyer identity,
-- and every raw tickets.* / orders.* column. Do NOT add sensitive columns here.
-- =============================================================================
CREATE OR REPLACE VIEW public.ticket_resale_listings_public
WITH (security_invoker = on) AS
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

GRANT SELECT ON public.ticket_resale_listings_public TO anon, authenticated;

-- =============================================================================
-- RPCs: race-safe initiate + atomic finalize
-- =============================================================================

-- Reserve a listing for a buyer for N minutes. Race-safe via row lock.
CREATE OR REPLACE FUNCTION public.initiate_resale_purchase(
  _listing_id uuid,
  _buyer_user_id uuid,
  _expires_minutes integer DEFAULT 10
)
RETURNS public.ticket_resale_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ticket_resale_listings;
BEGIN
  IF _buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'Buyer required';
  END IF;

  SELECT * INTO l
  FROM public.ticket_resale_listings
  WHERE id = _listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = 'P0002';
  END IF;

  -- Lazy expiry: if a prior pending_payment lapsed, revert to active first.
  IF l.status = 'pending_payment' AND l.payment_expires_at IS NOT NULL AND l.payment_expires_at < now() THEN
    UPDATE public.ticket_resale_listings
      SET status = 'active', buyer_user_id = NULL, payment_expires_at = NULL, payment_ref = NULL
      WHERE id = l.id
      RETURNING * INTO l;
  END IF;

  IF l.status <> 'active' THEN
    RAISE EXCEPTION 'Listing is not available (status=%)', l.status USING ERRCODE = 'P0001';
  END IF;

  IF l.seller_user_id = _buyer_user_id THEN
    RAISE EXCEPTION 'Cannot buy your own listing' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ticket_resale_listings
    SET status = 'pending_payment',
        buyer_user_id = _buyer_user_id,
        payment_expires_at = now() + make_interval(mins => GREATEST(_expires_minutes, 1))
    WHERE id = l.id
    RETURNING * INTO l;

  RETURN l;
END;
$$;

REVOKE ALL ON FUNCTION public.initiate_resale_purchase(uuid, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.initiate_resale_purchase(uuid, uuid, integer) TO service_role;

-- Atomically finalize a verified resale: rotate qr_token, reassign owner, mark sold, audit.
CREATE OR REPLACE FUNCTION public.complete_resale_transfer(
  _listing_id uuid,
  _payment_ref text,
  _payment_provider text,
  _new_qr_token text
)
RETURNS public.resale_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ticket_resale_listings;
  t public.tickets;
  transfer public.resale_transfers;
  prev_hash text;
BEGIN
  IF _new_qr_token IS NULL OR length(_new_qr_token) < 16 THEN
    RAISE EXCEPTION 'New qr_token must be a strong random value';
  END IF;

  SELECT * INTO l FROM public.ticket_resale_listings WHERE id = _listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF l.status NOT IN ('pending_payment','active') THEN
    RAISE EXCEPTION 'Listing not finalizable (status=%)', l.status;
  END IF;

  IF l.buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'Listing has no assigned buyer';
  END IF;

  SELECT * INTO t FROM public.tickets WHERE id = l.ticket_id FOR UPDATE;
  prev_hash := encode(digest(t.qr_token, 'sha256'), 'hex');

  -- Rotate credential + reassign ownership atomically.
  UPDATE public.tickets
    SET qr_token = _new_qr_token,
        qr_token_version = qr_token_version + 1,
        current_owner_user_id = l.buyer_user_id,
        revoked_at = NULL
    WHERE id = t.id;

  -- Allow the active->sold direct transition when called from this SECURITY DEFINER RPC
  -- (covers callers that skipped the pending_payment reserve step, e.g. fast provider webhooks).
  PERFORM set_config('app.allow_direct_sold', 'on', true);

  UPDATE public.ticket_resale_listings
    SET status = 'sold',
        sold_at = now(),
        payment_ref = COALESCE(_payment_ref, payment_ref),
        payment_expires_at = NULL
    WHERE id = l.id;

  INSERT INTO public.resale_transfers(
    listing_id, ticket_id, seller_user_id, buyer_user_id,
    sale_price_kes, payment_ref, payment_provider, previous_qr_token_hash
  ) VALUES (
    l.id, t.id, l.seller_user_id, l.buyer_user_id,
    l.resale_price_kes, _payment_ref, _payment_provider, prev_hash
  ) RETURNING * INTO transfer;

  RETURN transfer;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_resale_transfer(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_resale_transfer(uuid, text, text, text) TO service_role;

-- Housekeeping RPC: expire lapsed pending_payment reservations back to active.
CREATE OR REPLACE FUNCTION public.expire_stale_resale_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH updated AS (
    UPDATE public.ticket_resale_listings
      SET status = 'active', buyer_user_id = NULL, payment_expires_at = NULL, payment_ref = NULL
      WHERE status = 'pending_payment'
        AND payment_expires_at IS NOT NULL
        AND payment_expires_at < now()
      RETURNING 1
  ) SELECT count(*) INTO n FROM updated;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_resale_reservations() FROM public;
GRANT EXECUTE ON FUNCTION public.expire_stale_resale_reservations() TO service_role, authenticated;

-- Ensure pgcrypto for digest() is available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
