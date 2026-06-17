-- Platform activity/error logs for super admin dashboard.

CREATE TYPE public.log_level AS ENUM ('info', 'warn', 'error');

CREATE TABLE public.platform_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level public.log_level NOT NULL DEFAULT 'info',
  action text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_logs_created_idx ON public.platform_logs (created_at DESC);
CREATE INDEX platform_logs_level_idx ON public.platform_logs (level, created_at DESC);

ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert logs"
  ON public.platform_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super admins read platform logs"
  ON public.platform_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Separate buyer service fee from platform fee on orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_fee_kes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_kes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_holders jsonb;

UPDATE public.orders
  SET buyer_fee_kes = organizer_fee_kes
  WHERE buyer_fee_kes = 0 AND organizer_fee_kes > 0;

UPDATE public.orders
  SET platform_fee_kes = GREATEST(0, ROUND(subtotal_kes * 0.10))
  WHERE platform_fee_kes = 0 AND subtotal_kes > 0 AND fee_waived = false;

-- Per-ticket holder phone for individual delivery.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS holder_phone text;
