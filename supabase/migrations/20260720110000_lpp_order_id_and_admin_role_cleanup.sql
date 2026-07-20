-- Link completed LPP plans to issued orders and normalize platform roles.

ALTER TABLE public.payment_plans
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id);

CREATE INDEX IF NOT EXISTS idx_payment_plans_order_id
  ON public.payment_plans(order_id);

UPDATE public.user_roles
SET role = 'admin'::public.app_role
WHERE role = 'super_admin'::public.app_role
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles existing
    WHERE existing.user_id = user_roles.user_id
      AND existing.role = 'admin'::public.app_role
  );

DELETE FROM public.user_roles
WHERE role = 'super_admin'::public.app_role;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_no_super_admin;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_no_super_admin
  CHECK (role::text <> 'super_admin');

DROP POLICY IF EXISTS "Organizers view own withdrawals" ON public.withdrawals;
CREATE POLICY "Organizers view own withdrawals"
ON public.withdrawals FOR SELECT
USING (
  organizer_id IN (SELECT id FROM public.organizer_profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Super admins update withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Admins update withdrawals" ON public.withdrawals;
CREATE POLICY "Admins update withdrawals"
ON public.withdrawals FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins delete withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Admins delete withdrawals" ON public.withdrawals;
CREATE POLICY "Admins delete withdrawals"
ON public.withdrawals FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users view own payments via orders" ON public.payments;
CREATE POLICY "Users view own payments via orders"
ON public.payments FOR SELECT
USING (
  order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Super admins manage approval requests" ON public.organizer_approval_requests;
DROP POLICY IF EXISTS "Admins manage approval requests" ON public.organizer_approval_requests;
CREATE POLICY "Admins manage approval requests"
  ON public.organizer_approval_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Super admins read platform logs" ON public.platform_logs;
DROP POLICY IF EXISTS "Admins read platform logs" ON public.platform_logs;
CREATE POLICY "Admins read platform logs"
  ON public.platform_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins manage homepage settings" ON public.homepage_settings;
CREATE POLICY "Admins manage homepage settings"
  ON public.homepage_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
