-- Fix: Remove seller_payout_phone guard from complete_resale_transfer.
-- The payout phone check belongs only in approve_resale_transfer (admin step),
-- not in complete_resale_transfer (callback step that records buyer payment).
-- Having it here causes the callback to fail silently when payout phone is missing,
-- leaving the listing stuck at pending_payment while the buyer's money is already taken.

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

  -- NOTE: seller_payout_phone is validated in approve_resale_transfer (admin step),
  -- not here. This function only records that the buyer has paid.

  UPDATE public.ticket_resale_listings
    SET status = 'pending_approval',
        payment_ref = COALESCE(_payment_ref, payment_ref),
        payment_expires_at = NULL
    WHERE id = l.id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_resale_transfer(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_resale_transfer(uuid, text, text, text) TO service_role;
