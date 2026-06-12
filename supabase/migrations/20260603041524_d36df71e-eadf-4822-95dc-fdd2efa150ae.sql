-- Paystack rewire: add subaccount + fee lock, drop withdrawal infra

ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text,
  ADD COLUMN IF NOT EXISTS paystack_bank_code text,
  ADD COLUMN IF NOT EXISTS paystack_account_number text,
  ADD COLUMN IF NOT EXISTS paystack_account_name text,
  ADD COLUMN IF NOT EXISTS fee_locked_pct integer;

-- Drop payout/withdrawal columns no longer used
ALTER TABLE public.organizer_profiles
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS bank_account_name,
  DROP COLUMN IF EXISTS mpesa_phone,
  DROP COLUMN IF EXISTS preferred_payout_channel,
  DROP COLUMN IF EXISTS payout_method,
  DROP COLUMN IF EXISTS mpesa_till;

-- Drop withdrawals table entirely (we no longer hold funds)
DROP TABLE IF EXISTS public.withdrawals CASCADE;

-- Add paystack_reference to payments for idempotency / lookup
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paystack_reference text;

CREATE INDEX IF NOT EXISTS payments_paystack_reference_idx
  ON public.payments (paystack_reference);

-- Replace publish-count trigger: also lock fee at 5% on the first publish
CREATE OR REPLACE FUNCTION public.bump_organizer_publish_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    update public.organizer_profiles
      set
        events_published_count = events_published_count + 1,
        fee_locked_pct = coalesce(fee_locked_pct, 5)
      where id = new.organizer_id;
  end if;
  return new;
end;
$function$;