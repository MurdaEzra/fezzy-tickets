-- Add buyer_fee_kes and subtotal_kes columns to checkout_sessions table
ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS buyer_fee_kes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_kes integer NOT NULL DEFAULT 0;
