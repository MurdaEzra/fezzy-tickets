import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { orderId } = await req.json();
    if (!orderId) return new Response(JSON.stringify({ error: 'orderId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: order } = await supabase.from('orders').select('id, status, payment_ref').eq('id', orderId).single();
    const { data: payment } = await supabase.from('payments').select('status, mpesa_receipt, result_desc').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle();

    return new Response(JSON.stringify({
      orderStatus: order?.status ?? 'unknown',
      paymentStatus: payment?.status ?? 'pending',
      receipt: payment?.mpesa_receipt ?? null,
      message: payment?.result_desc ?? null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
