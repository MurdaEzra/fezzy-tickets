import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('ticket_resale_listings')
    .select('id, status, payment_ref, mpesa_receipt, buyer_user_id')
    .eq('status', 'pending_payment')
    .order('updated_at', { ascending: false })
    .limit(3);
  console.log(error || data);
}
check();
