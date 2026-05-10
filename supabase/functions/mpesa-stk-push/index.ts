import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits;
  return digits;
}

async function getDarajaToken(env: string, key: string, secret: string) {
  const base = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(`${base}/oauth/v1/generate/token?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed: ${await res.text()}`);
  const json = await res.json();
  return { token: json.access_token as string, base };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { eventId, tierId, quantity, name, email, phone } = await req.json();
    if (!eventId || !tierId || !quantity || !name || !email || !phone) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers').select('id, price_kes, event_id, quantity, sold').eq('id', tierId).single();
    if (tierErr || !tier) return new Response(JSON.stringify({ error: 'Tier not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (tier.event_id !== eventId) return new Response(JSON.stringify({ error: 'Tier/event mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (tier.sold + quantity > tier.quantity) return new Response(JSON.stringify({ error: 'Not enough tickets remaining' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const subtotal = tier.price_kes * quantity;
    const fee = Math.round(subtotal * 0.05);
    const total = subtotal;

    const msisdn = normalizePhone(phone);
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      return new Response(JSON.stringify({ error: 'Invalid phone number' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = data?.user?.id ?? null;
    }

    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      event_id: eventId,
      user_id: userId,
      guest_name: name,
      guest_email: email,
      guest_phone: msisdn,
      payment_method: 'mpesa',
      subtotal_kes: subtotal,
      organizer_fee_kes: fee,
      total_kes: total,
      status: 'pending',
      payment_ref: `${tierId}:${quantity}`,
    }).select().single();
    if (orderErr || !order) throw new Error(orderErr?.message || 'Failed to create order');

    const env = Deno.env.get('MPESA_ENV') || 'sandbox';
    const shortcode = Deno.env.get('MPESA_SHORTCODE')!;
    const passkey = Deno.env.get('MPESA_PASSKEY')!;
    const { token, base } = await getDarajaToken(env, Deno.env.get('MPESA_CONSUMER_KEY')!, Deno.env.get('MPESA_CONSUMER_SECRET')!);

    const ts = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${ts}`);
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;

    const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: total,
        PartyA: msisdn,
        PartyB: shortcode,
        PhoneNumber: msisdn,
        CallBackURL: callbackUrl,
        AccountReference: order.id.slice(0, 12),
        TransactionDesc: 'Ticket purchase',
      }),
    });
    const stk = await stkRes.json();

    if (!stkRes.ok || stk.ResponseCode !== '0') {
      await supabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
      return new Response(JSON.stringify({ error: stk.errorMessage || stk.ResponseDescription || 'STK push failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('payments').insert({
      order_id: order.id,
      provider: 'mpesa',
      amount_kes: total,
      phone: msisdn,
      merchant_request_id: stk.MerchantRequestID,
      checkout_request_id: stk.CheckoutRequestID,
      status: 'pending',
    });

    return new Response(JSON.stringify({
      orderId: order.id,
      checkoutRequestId: stk.CheckoutRequestID,
      message: 'STK push sent. Check your phone.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('mpesa-stk-push error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
