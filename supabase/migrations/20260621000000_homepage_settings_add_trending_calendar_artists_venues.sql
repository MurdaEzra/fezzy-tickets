-- Add columns to homepage_settings for trending events, calendar events, artists, and iconic venues
ALTER TABLE public.homepage_settings
ADD COLUMN IF NOT EXISTS trending_event_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
ADD COLUMN IF NOT EXISTS calendar_event_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
ADD COLUMN IF NOT EXISTS artists jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS iconic_venues jsonb NOT NULL DEFAULT '[]'::jsonb;
