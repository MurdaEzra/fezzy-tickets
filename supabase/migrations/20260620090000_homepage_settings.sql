CREATE TABLE IF NOT EXISTS public.homepage_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  live_bar_items text[] NOT NULL DEFAULT ARRAY[
    'Sol Fest tickets now live - Early Bird ends in 4 days',
    'Use code FEZZY25 for 15% off your first purchase',
    'Now serving Nairobi, Mombasa, Kisumu, Nakuru and Eldoret'
  ],
  headliner_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.homepage_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Homepage settings viewable by everyone" ON public.homepage_settings;
CREATE POLICY "Homepage settings viewable by everyone"
  ON public.homepage_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage homepage settings" ON public.homepage_settings;
CREATE POLICY "Admins manage homepage settings"
  ON public.homepage_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION public.touch_homepage_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homepage_settings_updated_at ON public.homepage_settings;
CREATE TRIGGER trg_homepage_settings_updated_at
  BEFORE UPDATE ON public.homepage_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_homepage_settings();
