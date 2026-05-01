-- Promote existing users to super_admin (single-owner dev project)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users
ON CONFLICT DO NOTHING;

-- Payout columns on organizer_profiles
ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS mpesa_phone text,
  ADD COLUMN IF NOT EXISTS preferred_payout_channel text DEFAULT 'mpesa';

-- Withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  amount_kes integer NOT NULL CHECK (amount_kes > 0),
  channel text NOT NULL CHECK (channel IN ('mpesa','bank')),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  payhero_reference text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers view own withdrawals" ON public.withdrawals;
CREATE POLICY "Organizers view own withdrawals"
ON public.withdrawals FOR SELECT
USING (
  organizer_id IN (SELECT id FROM public.organizer_profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Organizers create own withdrawals" ON public.withdrawals;
CREATE POLICY "Organizers create own withdrawals"
ON public.withdrawals FOR INSERT
WITH CHECK (
  organizer_id IN (SELECT id FROM public.organizer_profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Super admins update withdrawals" ON public.withdrawals;
CREATE POLICY "Super admins update withdrawals"
ON public.withdrawals FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins delete withdrawals" ON public.withdrawals;
CREATE POLICY "Super admins delete withdrawals"
ON public.withdrawals FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_withdrawals_updated_at ON public.withdrawals;
CREATE TRIGGER trg_withdrawals_updated_at
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();