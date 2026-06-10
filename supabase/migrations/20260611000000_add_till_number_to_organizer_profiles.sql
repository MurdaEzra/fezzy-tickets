ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS till_number text;
