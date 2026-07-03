
-- Lipa Pole Pole (BNPL) schema
-- Add organizer-configurable installment plans per event
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS lpp_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lpp_config jsonb NOT NULL DEFAULT '{"plans":[{"id":"quick","label":"Quick pay","deposit_pct":50,"installments":2,"interval_days":14},{"id":"steady","label":"Steady pace","deposit_pct":30,"installments":3,"interval_days":21},{"id":"easy","label":"Easy stretch","deposit_pct":20,"installments":4,"interval_days":14}]}'::jsonb;

-- Payment plans (one per LPP reservation)
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no text NOT NULL UNIQUE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.ticket_tiers(id),
  quantity integer NOT NULL CHECK (quantity >= 1),
  user_id uuid,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text NOT NULL,
  plan_key text NOT NULL,
  plan_label text NOT NULL,
  deposit_pct numeric(5,2) NOT NULL,
  installments_count integer NOT NULL,
  interval_days integer NOT NULL,
  subtotal_kes integer NOT NULL,
  buyer_fee_kes integer NOT NULL DEFAULT 0,
  total_kes integer NOT NULL,
  deposit_kes integer NOT NULL,
  paid_kes integer NOT NULL DEFAULT 0,
  balance_kes integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reserved','completed','cancelled','expired')),
  ticket_holders jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_starts_at timestamptz NOT NULL,
  final_due_at timestamptz NOT NULL,
  reserved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_plans TO authenticated;
GRANT SELECT ON public.payment_plans TO anon;
GRANT ALL ON public.payment_plans TO service_role;

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan by ref_no"
  ON public.payment_plans FOR SELECT
  USING (true);

CREATE POLICY "Service role manages plans"
  ON public.payment_plans FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Owner can view own plan"
  ON public.payment_plans FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_payment_plans_ref ON public.payment_plans(ref_no);
CREATE INDEX IF NOT EXISTS idx_payment_plans_event ON public.payment_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_user ON public.payment_plans(user_id);

-- Individual installments — each has its own UUID
CREATE TABLE IF NOT EXISTS public.payment_plan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deposit','installment')),
  amount_kes integer NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','failed')),
  paid_at timestamptz,
  payment_ref text,
  provider_receipt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, sequence)
);

GRANT SELECT, INSERT, UPDATE ON public.payment_plan_installments TO authenticated;
GRANT SELECT ON public.payment_plan_installments TO anon;
GRANT ALL ON public.payment_plan_installments TO service_role;

ALTER TABLE public.payment_plan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view installments"
  ON public.payment_plan_installments FOR SELECT
  USING (true);

CREATE POLICY "Service role manages installments"
  ON public.payment_plan_installments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_installments_plan ON public.payment_plan_installments(plan_id);

CREATE TRIGGER trg_payment_plans_updated
  BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_installments_updated
  BEFORE UPDATE ON public.payment_plan_installments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
