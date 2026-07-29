-- Migration: Sync profile payout_phone to resale escrow details

CREATE OR REPLACE FUNCTION public.sync_payout_phone_to_resale()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if phone is being set for the first time, or if it changed
  IF (TG_OP = 'INSERT' AND NEW.payout_phone IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.payout_phone IS DISTINCT FROM OLD.payout_phone) THEN
    
    -- Update listings that have not been fully finalized yet
    UPDATE public.ticket_resale_listings
    SET seller_payout_phone = NEW.payout_phone
    WHERE seller_user_id = NEW.id
      AND status IN ('active', 'pending', 'pending_payment', 'pending_approval');
      
    -- Update active transfers where payout hasn't been completed yet
    -- We skip 'processing' and 'paid' statuses as those are already finalized/in-flight
    UPDATE public.resale_transfers
    SET seller_payout_phone = NEW.payout_phone
    WHERE seller_user_id = NEW.id
      AND payout_status IN ('pending', 'failed');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_payout_phone_to_resale ON public.profiles;

CREATE TRIGGER trigger_sync_payout_phone_to_resale
AFTER INSERT OR UPDATE OF payout_phone ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_payout_phone_to_resale();
