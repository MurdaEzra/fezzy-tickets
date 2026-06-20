ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lineup jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.ticket_tiers
  ADD COLUMN IF NOT EXISTS valid_dates jsonb NOT NULL DEFAULT '[]'::jsonb;
