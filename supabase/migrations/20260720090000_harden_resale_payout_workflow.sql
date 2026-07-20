-- Harden resale listing, approval, and seller payout workflow.

ALTER TYPE public.resale_listing_status ADD VALUE IF NOT EXISTS 'pending_approval';

ALTER TABLE public.ticket_resale_listings
  ADD COLUMN IF NOT EXISTS seller_payout_phone text,
  ADD COLUMN IF NOT EXISTS mpesa_receipt text;

ALTER TABLE public.resale_transfers
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS seller_payout_phone text,
  ADD COLUMN IF NOT EXISTS payout_ref text,
  ADD COLUMN IF NOT EXISTS payout_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_error text;

CREATE INDEX IF NOT EXISTS idx_resale_transfers_payout_status
  ON public.resale_transfers(payout_status);

-- Status transition guard for the admin-review flow.
CREATE OR REPLACE FUNCTION public.enforce_resale_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'active' AND NEW.status IN ('pending_payment','cancelled','expired'))
      OR (OLD.status = 'pending_payment' AND NEW.status IN ('pending_approval','active','expired','cancelled'))
      OR (OLD.status = 'pending_approval' AND NEW.status IN ('sold','cancelled'))
      OR (OLD.status = 'active' AND NEW.status = 'sold' AND current_setting('app.allow_direct_sold', true) = 'on')
    ) THEN
      RAISE EXCEPTION 'Illegal resale listing status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- STK success only confirms buyer payment. Ticket ownership changes after admin approval.
CREATE OR REPLACE FUNCTION public.complete_resale_transfer(
  _listing_id uuid,
  _payment_ref text,
  _payment_provider text,
  _new_qr_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ticket_resale_listings;
BEGIN
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

  IF l.seller_payout_phone IS NULL OR trim(l.seller_payout_phone) = '' THEN
    RAISE EXCEPTION 'Seller payout phone is required before approval';
  END IF;

  UPDATE public.ticket_resale_listings
    SET status = 'pending_approval',
        payment_ref = COALESCE(_payment_ref, payment_ref),
        payment_expires_at = NULL
    WHERE id = l.id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_resale_transfer(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_resale_transfer(uuid, text, text, text) TO service_role;

-- Super-admin approval performs the actual ticket transfer and QR rotation.
CREATE OR REPLACE FUNCTION public.approve_resale_transfer(
  _admin_user_id uuid,
  _listing_id uuid,
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
  IF NOT public.has_role(_admin_user_id, 'admin') THEN
    RAISE EXCEPTION 'Forbidden: Admin only';
  END IF;

  IF _new_qr_token IS NULL OR length(_new_qr_token) < 16 THEN
    RAISE EXCEPTION 'New qr_token must be a strong random value';
  END IF;

  SELECT * INTO l FROM public.ticket_resale_listings WHERE id = _listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF l.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Listing is not awaiting approval (status=%)', l.status;
  END IF;

  IF l.buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'Listing has no assigned buyer';
  END IF;

  IF l.seller_payout_phone IS NULL OR trim(l.seller_payout_phone) = '' THEN
    RAISE EXCEPTION 'Seller payout phone is required';
  END IF;

  SELECT * INTO t FROM public.tickets WHERE id = l.ticket_id FOR UPDATE;
  prev_hash := encode(digest(t.qr_token, 'sha256'), 'hex');

  UPDATE public.tickets
    SET qr_token = _new_qr_token,
        qr_token_version = qr_token_version + 1,
        current_owner_user_id = l.buyer_user_id,
        revoked_at = NULL
    WHERE id = t.id;

  UPDATE public.ticket_resale_listings
    SET status = 'sold',
        sold_at = now()
    WHERE id = l.id;

  INSERT INTO public.resale_transfers(
    listing_id, ticket_id, seller_user_id, buyer_user_id,
    sale_price_kes, payment_ref, payment_provider, previous_qr_token_hash,
    payout_status, seller_payout_phone
  ) VALUES (
    l.id, t.id, l.seller_user_id, l.buyer_user_id,
    l.resale_price_kes, l.payment_ref, 'mpesa', prev_hash,
    'pending', l.seller_payout_phone
  ) RETURNING * INTO transfer;

  RETURN transfer;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_resale_transfer(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.approve_resale_transfer(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_resale_transfer(uuid, uuid, text) TO service_role;

-- Seller payout phone can still be corrected for legacy transfers, but new
-- listings must collect it before publishing to the marketplace.
CREATE OR REPLACE FUNCTION public.update_resale_payout_phone(
  _transfer_id uuid,
  _phone text
)
RETURNS public.resale_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transfer public.resale_transfers;
BEGIN
  IF _phone IS NULL OR trim(_phone) = '' THEN
    RAISE EXCEPTION 'Phone number required';
  END IF;

  SELECT * INTO transfer FROM public.resale_transfers WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF transfer.seller_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF transfer.payout_status = 'paid' THEN
    RAISE EXCEPTION 'Payout already completed';
  END IF;

  UPDATE public.resale_transfers
    SET seller_payout_phone = _phone
    WHERE id = transfer.id
    RETURNING * INTO transfer;

  RETURN transfer;
END;
$$;

REVOKE ALL ON FUNCTION public.update_resale_payout_phone(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_resale_payout_phone(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_resale_listings()
RETURNS TABLE (
  listing_id uuid,
  resale_price_kes integer,
  status text,
  listed_at timestamptz,
  sold_at timestamptz,
  payment_ref text,
  event_id uuid,
  event_title text,
  event_starts_at timestamptz,
  seller_user_id uuid,
  buyer_user_id uuid,
  seller_email varchar,
  buyer_email varchar,
  transfer_id uuid,
  payout_status text,
  seller_payout_phone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS listing_id,
    l.resale_price_kes,
    l.status::text,
    l.listed_at,
    l.sold_at,
    l.payment_ref,
    e.id AS event_id,
    e.title AS event_title,
    e.starts_at AS event_starts_at,
    l.seller_user_id,
    l.buyer_user_id,
    su.email::varchar AS seller_email,
    bu.email::varchar AS buyer_email,
    rt.id AS transfer_id,
    rt.payout_status,
    COALESCE(rt.seller_payout_phone, l.seller_payout_phone) AS seller_payout_phone
  FROM public.ticket_resale_listings l
  JOIN public.events e ON e.id = l.event_id
  LEFT JOIN auth.users su ON su.id = l.seller_user_id
  LEFT JOIN auth.users bu ON bu.id = l.buyer_user_id
  LEFT JOIN public.resale_transfers rt ON rt.listing_id = l.id
  WHERE public.has_role(auth.uid(), 'admin')
    AND l.status IN ('pending_approval', 'sold')
  ORDER BY l.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_get_resale_listings() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_resale_listings() TO authenticated, service_role;
