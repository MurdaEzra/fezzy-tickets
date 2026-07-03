-- Create checkout_sessions, payment_attempts, payment_webhook_events tables
-- Checkout sessions table
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token text NOT NULL UNIQUE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.ticket_tiers(id),
  quantity integer NOT NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subtotal_kes integer NOT NULL DEFAULT 0,
  buyer_fee_kes integer NOT NULL DEFAULT 0,
  total_kes integer NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'created',
  allowed_methods jsonb NOT NULL DEFAULT '["mpesa"]'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payment attempts table
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  provider text NOT NULL,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  amount_kes integer NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  idempotency_key text NOT NULL UNIQUE,
  merchant_reference text NOT NULL UNIQUE,
  provider_reference text,
  provider_transaction_id text,
  redirect_state text,
  redirect_nonce text,
  failure_code text,
  failure_reason_safe text,
  provider_payload_last jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payment webhook events table
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text,
  delivery_id text,
  signature_valid boolean NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  event_type text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  processing_error_safe text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grant all permissions to everyone
GRANT ALL PRIVILEGES ON public.checkout_sessions TO service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON public.payment_attempts TO service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON public.payment_webhook_events TO service_role, authenticated, anon;

-- Enable RLS
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role manages all checkout_sessions" ON public.checkout_sessions;
DROP POLICY IF EXISTS "Service role manages all payment_attempts" ON public.payment_attempts;
DROP POLICY IF EXISTS "Service role manages all payment_webhook_events" ON public.payment_webhook_events;
DROP POLICY IF EXISTS "Anyone can view checkout session by public_token" ON public.checkout_sessions;

-- Super permissive policies for everyone
CREATE POLICY "Allow all operations on checkout_sessions"
  ON public.checkout_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on payment_attempts"
  ON public.payment_attempts FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on payment_webhook_events"
  ON public.payment_webhook_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checkout_sessions_updated_at
  BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_payment_attempts_updated_at
  BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_public_token ON public.checkout_sessions(public_token);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_event ON public.checkout_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_checkout ON public.payment_attempts(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_merchant_ref ON public.payment_attempts(merchant_reference);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_dedupe ON public.payment_webhook_events(dedupe_key);
