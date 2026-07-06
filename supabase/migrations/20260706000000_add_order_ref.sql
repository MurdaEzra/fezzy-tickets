
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ref text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_ref ON orders(ref);
