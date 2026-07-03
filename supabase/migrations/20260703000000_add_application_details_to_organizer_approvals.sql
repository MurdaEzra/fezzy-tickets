ALTER TABLE public.organizer_approval_requests
  ADD COLUMN IF NOT EXISTS application_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organizer_approval_requests.application_details
  IS 'Organizer onboarding answers collected before account creation.';
