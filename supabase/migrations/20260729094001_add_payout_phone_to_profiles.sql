-- Migration: Add payout_phone to public.profiles

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payout_phone text;
