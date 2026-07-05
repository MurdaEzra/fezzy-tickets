
-- Add new enums
CREATE TYPE ticket_resale_listing_status AS ENUM ('active', 'cancelled', 'completed');
CREATE TYPE ticket_payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE ticket_ownership_source AS ENUM ('initial_purchase', 'resale_purchase');

-- Add resale configuration to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_resale boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_resale_percentage integer DEFAULT 120;
ALTER TABLE events ADD COLUMN IF NOT EXISTS min_resale_percentage integer DEFAULT 80;
ALTER TABLE events ADD COLUMN IF NOT EXISTS resale_fee_percentage integer DEFAULT 10;
ALTER TABLE events ADD COLUMN IF NOT EXISTS resale_close_hours_before_event integer DEFAULT 24;

-- Create ticket_ownerships table (for ownership history)
CREATE TABLE IF NOT EXISTS ticket_ownerships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    previous_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    new_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    purchase_amount_kes integer NOT NULL,
    purchase_source ticket_ownership_source NOT NULL,
    transaction_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create ticket_resale_listings table
CREATE TABLE IF NOT EXISTS ticket_resale_listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
    seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resale_price_kes integer NOT NULL,
    status ticket_resale_listing_status NOT NULL DEFAULT 'active',
    listed_at timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create ticket_resale_transactions table
CREATE TABLE IF NOT EXISTS ticket_resale_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES ticket_resale_listings(id) ON DELETE CASCADE,
    buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    total_amount_kes integer NOT NULL,
    resale_price_kes integer NOT NULL,
    platform_fee_kes integer NOT NULL,
    payment_method text NOT NULL,
    payment_ref text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create ticket_qr_versions table (for QR token history)
CREATE TABLE IF NOT EXISTS ticket_qr_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    qr_token text NOT NULL,
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create ticket_payouts table
CREATE TABLE IF NOT EXISTS ticket_payouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id uuid NOT NULL REFERENCES ticket_resale_transactions(id) ON DELETE CASCADE,
    amount_kes integer NOT NULL,
    status ticket_payout_status NOT NULL DEFAULT 'pending',
    payout_method text,
    payout_ref text,
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create ticket_activity_logs table
CREATE TABLE IF NOT EXISTS ticket_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ticket_ownerships_updated_at BEFORE UPDATE ON ticket_ownerships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_resale_listings_updated_at BEFORE UPDATE ON ticket_resale_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_resale_transactions_updated_at BEFORE UPDATE ON ticket_resale_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_payouts_updated_at BEFORE UPDATE ON ticket_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_ticket_ownerships_ticket_id ON ticket_ownerships(ticket_id);
CREATE INDEX idx_ticket_ownerships_new_owner_id ON ticket_ownerships(new_owner_id);
CREATE INDEX idx_ticket_resale_listings_seller_id ON ticket_resale_listings(seller_id);
CREATE INDEX idx_ticket_resale_listings_ticket_id ON ticket_resale_listings(ticket_id);
CREATE INDEX idx_ticket_resale_listings_status ON ticket_resale_listings(status);
CREATE INDEX idx_ticket_resale_transactions_listing_id ON ticket_resale_transactions(listing_id);
CREATE INDEX idx_ticket_resale_transactions_buyer_id ON ticket_resale_transactions(buyer_id);
CREATE INDEX idx_ticket_resale_transactions_seller_id ON ticket_resale_transactions(seller_id);
CREATE INDEX idx_ticket_qr_versions_ticket_id ON ticket_qr_versions(ticket_id);
CREATE INDEX idx_ticket_qr_versions_is_active ON ticket_qr_versions(is_active);
CREATE INDEX idx_ticket_payouts_seller_id ON ticket_payouts(seller_id);
CREATE INDEX idx_ticket_payouts_transaction_id ON ticket_payouts(transaction_id);
CREATE INDEX idx_ticket_activity_logs_ticket_id ON ticket_activity_logs(ticket_id);

-- Enable Row Level Security (RLS)
ALTER TABLE ticket_ownerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_resale_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_resale_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_qr_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Ticket Ownerships Policies
CREATE POLICY "Users can view ownership history for their tickets"
    ON ticket_ownerships FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets t
            JOIN ticket_ownerships to2 ON t.id = to2.ticket_id
            WHERE t.id = ticket_ownerships.ticket_id
            AND to2.new_owner_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert ownership records"
    ON ticket_ownerships FOR INSERT
    WITH CHECK (true);

-- Ticket Resale Listings Policies
CREATE POLICY "Everyone can view active listings"
    ON ticket_resale_listings FOR SELECT
    USING (status = 'active');

CREATE POLICY "Users can view their own listings"
    ON ticket_resale_listings FOR SELECT
    USING (seller_id = auth.uid());

CREATE POLICY "Users can create listings"
    ON ticket_resale_listings FOR INSERT
    WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Users can update their own listings"
    ON ticket_resale_listings FOR UPDATE
    USING (seller_id = auth.uid());

-- Ticket Resale Transactions Policies
CREATE POLICY "Users can view their own transactions (buyer or seller)"
    ON ticket_resale_transactions FOR SELECT
    USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Service role can insert transactions"
    ON ticket_resale_transactions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update transactions"
    ON ticket_resale_transactions FOR UPDATE
    USING (true);

-- Ticket QR Versions Policies
CREATE POLICY "Users can view active QR versions for their tickets"
    ON ticket_qr_versions FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM tickets t
            JOIN orders o ON t.order_id = o.id
            WHERE t.id = ticket_qr_versions.ticket_id
            AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert QR versions"
    ON ticket_qr_versions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update QR versions"
    ON ticket_qr_versions FOR UPDATE
    USING (true);

-- Ticket Payouts Policies
CREATE POLICY "Users can view their own payouts"
    ON ticket_payouts FOR SELECT
    USING (seller_id = auth.uid());

CREATE POLICY "Service role can insert payouts"
    ON ticket_payouts FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update payouts"
    ON ticket_payouts FOR UPDATE
    USING (true);

-- Ticket Activity Logs Policies
CREATE POLICY "Users can view activity logs for their tickets"
    ON ticket_activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets t
            JOIN orders o ON t.order_id = o.id
            WHERE t.id = ticket_activity_logs.ticket_id
            AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert activity logs"
    ON ticket_activity_logs FOR INSERT
    WITH CHECK (true);

