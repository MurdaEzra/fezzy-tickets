-- Create promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.organizer_profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for code per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_event_code ON public.promo_codes(event_id, LOWER(code));

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Policies for promo codes
CREATE POLICY "Organizers can manage their own promo codes"
  ON public.promo_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organizer_profiles
      WHERE organizer_profiles.id = promo_codes.organizer_id
      AND organizer_profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizer_profiles
      WHERE organizer_profiles.id = promo_codes.organizer_id
      AND organizer_profiles.user_id = auth.uid()
    )
  );

-- Policy for reading promo codes (only valid ones can be checked publicly)
CREATE POLICY "Anyone can check valid promo codes"
  ON public.promo_codes
  FOR SELECT
  USING (
    (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
    AND (max_uses IS NULL OR used_count < max_uses)
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.touch_promo_codes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promo_codes_updated_at ON public.promo_codes;
CREATE TRIGGER trg_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_promo_codes();
