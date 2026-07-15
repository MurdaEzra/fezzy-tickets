-- 1. Add seller_payout_phone to resale_transfers
ALTER TABLE public.resale_transfers 
  ADD COLUMN IF NOT EXISTS seller_payout_phone text;

-- 2. Create RPC for the seller to provide their payout phone number securely
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

  -- Ensure only the seller can update this
  IF transfer.seller_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Ensure we don't update if already paid out
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

-- 3. Create RPC for the Admin Dashboard to fetch full resale view with buyer/seller emails
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
    rt.seller_payout_phone
  FROM public.ticket_resale_listings l
  JOIN public.events e ON e.id = l.event_id
  LEFT JOIN auth.users su ON su.id = l.seller_user_id
  LEFT JOIN auth.users bu ON bu.id = l.buyer_user_id
  LEFT JOIN public.resale_transfers rt ON rt.listing_id = l.id
  WHERE l.status IN ('pending_approval', 'sold')
  ORDER BY l.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_get_resale_listings() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_resale_listings() TO authenticated, service_role;
