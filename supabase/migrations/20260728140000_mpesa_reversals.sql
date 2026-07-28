-- Platform-wide M-Pesa reversal tracking for failed/stuck transactions.
-- Covers primary purchases, LPP installments, and resale purchases.

-- 1. Add 'refunded' to resale listing status enum
ALTER TYPE public.resale_listing_status ADD VALUE IF NOT EXISTS 'refunded';

-- 2. Centralized reversals table
CREATE TABLE IF NOT EXISTS public.mpesa_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type text NOT NULL CHECK (payment_type IN ('primary', 'lpp', 'resale')),
  reference_id uuid NOT NULL,
  mpesa_receipt text NOT NULL,
  amount_kes integer NOT NULL CHECK (amount_kes > 0),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  reversal_transaction_id text,
  conversation_id text,
  error_message text,
  guest_phone text,
  guest_email text,
  guest_name text,
  event_title text,
  initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_reversals_type_ref ON public.mpesa_reversals(payment_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_reversals_status ON public.mpesa_reversals(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_reversals_receipt ON public.mpesa_reversals(mpesa_receipt);

GRANT SELECT ON public.mpesa_reversals TO authenticated;
GRANT ALL ON public.mpesa_reversals TO service_role;

ALTER TABLE public.mpesa_reversals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all reversals"
  ON public.mpesa_reversals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access to reversals"
  ON public.mpesa_reversals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_mpesa_reversals_updated_at
  BEFORE UPDATE ON public.mpesa_reversals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Update resale status transition trigger to allow pending_approval -> refunded
CREATE OR REPLACE FUNCTION public.enforce_resale_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'active' AND NEW.status IN ('pending_payment','cancelled','expired'))
      OR (OLD.status = 'pending_payment' AND NEW.status IN ('pending_approval','active','expired','cancelled','refunded'))
      OR (OLD.status = 'pending_approval' AND NEW.status IN ('sold','cancelled','refunded'))
      OR (OLD.status = 'active' AND NEW.status = 'sold' AND current_setting('app.allow_direct_sold', true) = 'on')
    ) THEN
      RAISE EXCEPTION 'Illegal resale listing status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Admin RPC: find all M-Pesa transactions that collected money but didn't complete
CREATE OR REPLACE FUNCTION public.admin_get_failed_mpesa_transactions()
RETURNS TABLE (
  payment_type text,
  reference_id uuid,
  mpesa_receipt text,
  amount_kes integer,
  guest_phone text,
  guest_email text,
  guest_name text,
  event_title text,
  event_id uuid,
  paid_at timestamptz,
  reversal_id uuid,
  reversal_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Primary: payment succeeded but no paid order exists
  SELECT
    'primary'::text AS payment_type,
    pa.id AS reference_id,
    pa.provider_transaction_id AS mpesa_receipt,
    pa.amount_kes,
    cs.guest_phone,
    cs.guest_email,
    cs.guest_name,
    e.title AS event_title,
    e.id AS event_id,
    pa.updated_at AS paid_at,
    mr.id AS reversal_id,
    mr.status AS reversal_status
  FROM public.payment_attempts pa
  JOIN public.checkout_sessions cs ON cs.id = pa.checkout_session_id
  JOIN public.events e ON e.id = cs.event_id
  LEFT JOIN public.orders o ON o.checkout_session_id = cs.id AND o.status = 'paid'
  LEFT JOIN public.mpesa_reversals mr ON mr.payment_type = 'primary' AND mr.reference_id = pa.id
  WHERE pa.status = 'succeeded'
    AND pa.provider = 'mpesa_daraja'
    AND pa.provider_transaction_id IS NOT NULL
    AND pa.provider_transaction_id <> ''
    AND o.id IS NULL
    AND public.has_role(auth.uid(), 'admin')

  UNION ALL

  -- LPP: installment marked paid with receipt but plan is cancelled/expired,
  -- or installment was double-charged (provider_receipt exists but status went back to pending)
  SELECT
    'lpp'::text AS payment_type,
    pi.id AS reference_id,
    pi.provider_receipt AS mpesa_receipt,
    pi.amount_kes,
    pp.guest_phone,
    pp.guest_email,
    pp.guest_name,
    e.title AS event_title,
    e.id AS event_id,
    pi.paid_at AS paid_at,
    mr.id AS reversal_id,
    mr.status AS reversal_status
  FROM public.payment_plan_installments pi
  JOIN public.payment_plans pp ON pp.id = pi.plan_id
  JOIN public.events e ON e.id = pp.event_id
  LEFT JOIN public.mpesa_reversals mr ON mr.payment_type = 'lpp' AND mr.reference_id = pi.id
  WHERE pi.provider_receipt IS NOT NULL
    AND pi.provider_receipt <> ''
    AND pp.status IN ('cancelled', 'expired')
    AND public.has_role(auth.uid(), 'admin')

  UNION ALL

  -- Resale: money collected (has receipt) but listing stuck in pending_payment/pending_approval
  -- and not progressing to sold
  SELECT
    'resale'::text AS payment_type,
    rl.id AS reference_id,
    rl.mpesa_receipt AS mpesa_receipt,
    rl.resale_price_kes AS amount_kes,
    bu.phone::text AS guest_phone,
    bu.email::text AS guest_email,
    COALESCE(bu.raw_user_meta_data->>'full_name', bu.email::text) AS guest_name,
    e.title AS event_title,
    e.id AS event_id,
    rl.updated_at AS paid_at,
    mr.id AS reversal_id,
    mr.status AS reversal_status
  FROM public.ticket_resale_listings rl
  JOIN public.events e ON e.id = rl.event_id
  LEFT JOIN auth.users bu ON bu.id = rl.buyer_user_id
  LEFT JOIN public.mpesa_reversals mr ON mr.payment_type = 'resale' AND mr.reference_id = rl.id
  WHERE rl.mpesa_receipt IS NOT NULL
    AND rl.mpesa_receipt <> ''
    AND rl.status IN ('pending_payment', 'pending_approval')
    AND public.has_role(auth.uid(), 'admin')

  ORDER BY paid_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_get_failed_mpesa_transactions() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_failed_mpesa_transactions() TO authenticated, service_role;
