
-- Ensure all resale-related columns exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_resale boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_resale_percentage integer DEFAULT 120;
ALTER TABLE events ADD COLUMN IF NOT EXISTS min_resale_percentage integer DEFAULT 80;
ALTER TABLE events ADD COLUMN IF NOT EXISTS resale_fee_percentage integer DEFAULT 10;
ALTER TABLE events ADD COLUMN IF NOT EXISTS resale_close_hours_before_event integer DEFAULT 24;

-- Add status column to ticket_resale_listings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_resale_listings' AND column_name = 'status') THEN
        -- If the type doesn't exist yet, create it
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_resale_listing_status') THEN
            CREATE TYPE ticket_resale_listing_status AS ENUM ('pending', 'active', 'cancelled', 'completed');
        END IF;
        
        ALTER TABLE ticket_resale_listings ADD COLUMN status ticket_resale_listing_status NOT NULL DEFAULT 'pending';
        ALTER TABLE ticket_resale_listings ADD COLUMN IF NOT EXISTS verification_token text;
        ALTER TABLE ticket_resale_listings ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz;
        ALTER TABLE ticket_resale_listings ADD COLUMN IF NOT EXISTS listed_at timestamptz;
        ALTER TABLE ticket_resale_listings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
        ALTER TABLE ticket_resale_listings ADD COLUMN IF NOT EXISTS completed_at timestamptz;
    END IF;
END
$$;
