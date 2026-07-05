-- Create lpp_reminders table to track sent reminders
CREATE TABLE IF NOT EXISTS lpp_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  installment_id UUID NOT NULL REFERENCES payment_plan_installments(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_lpp_reminders_plan_id ON lpp_reminders(plan_id);
CREATE INDEX IF NOT EXISTS idx_lpp_reminders_installment_id ON lpp_reminders(installment_id);
CREATE INDEX IF NOT EXISTS idx_lpp_reminders_sent_at ON lpp_reminders(sent_at);

-- Enable RLS (we can set policies if needed, but since this is for edge function, maybe just allow service role)
ALTER TABLE lpp_reminders ENABLE ROW LEVEL SECURITY;
