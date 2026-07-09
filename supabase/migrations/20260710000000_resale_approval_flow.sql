-- 1. Add pending_approval to resale_listing_status enum
ALTER TYPE public.resale_listing_status ADD VALUE IF NOT EXISTS 'pending_approval';

-- 2. Add payout_status to resale_transfers
ALTER TABLE public.resale_transfers 
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'pending';

-- 3. Replace complete_resale_transfer to halt ownership change and use pending_approval
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
  -- We ignore _new_qr_token here because the token generation and ownership transfer 
  -- is deferred until approve_resale_transfer.
  
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

  UPDATE public.ticket_resale_listings
    SET status = 'pending_approval',
        payment_ref = COALESCE(_payment_ref, payment_ref),
        payment_expires_at = NULL
    WHERE id = l.id;
END;
$$;

-- 4. Create approve_resale_transfer to finalize ownership transfer
CREATE OR REPLACE FUNCTION public.approve_resale_transfer(
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

  SELECT * INTO t FROM public.tickets WHERE id = l.ticket_id FOR UPDATE;
  prev_hash := encode(digest(t.qr_token, 'sha256'), 'hex');

  -- Rotate credential + reassign ownership atomically.
  UPDATE public.tickets
    SET qr_token = _new_qr_token,
        qr_token_version = qr_token_version + 1,
        current_owner_user_id = l.buyer_user_id,
        revoked_at = NULL
    WHERE id = t.id;

  PERFORM set_config('app.allow_direct_sold', 'on', true);

  UPDATE public.ticket_resale_listings
    SET status = 'sold',
        sold_at = now()
    WHERE id = l.id;

  INSERT INTO public.resale_transfers(
    listing_id, ticket_id, seller_user_id, buyer_user_id,
    sale_price_kes, payment_ref, payment_provider, previous_qr_token_hash, payout_status
  ) VALUES (
    l.id, t.id, l.seller_user_id, l.buyer_user_id,
    l.resale_price_kes, l.payment_ref, 'paystack', prev_hash, 'pending'
  ) RETURNING * INTO transfer;

  RETURN transfer;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_resale_transfer(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_resale_transfer(uuid, text) TO service_role;
