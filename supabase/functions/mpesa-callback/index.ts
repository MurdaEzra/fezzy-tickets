import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// HMAC-SHA256 signing (uses SUPABASE_SERVICE_ROLE_KEY as secret)
async function signToken(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  // base64url
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncode(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    console.log('mpesa-callback received', JSON.stringify(body));

    const stk = body?.Body?.stkCallback;
    if (!stk) return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Ignored' }), { headers: { 'Content-Type': 'application/json' } });

    const checkoutRequestId = stk.CheckoutRequestID;
    const resultCode = stk.ResultCode;
    const resultDesc = stk.ResultDesc;
    const items: Array<{ Name: string; Value?: string | number }> = stk.CallbackMetadata?.Item ?? [];
    const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value as string | undefined;

    const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SECRET);

    const { data: payment } = await supabase
      .from('payments').select('*').eq('checkout_request_id', checkoutRequestId).single();
    if (!payment) return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Unknown' }), { headers: { 'Content-Type': 'application/json' } });

    const newStatus = resultCode === 0 ? 'success' : 'failed';
    await supabase.from('payments').update({
      status: newStatus,
      result_code: resultCode,
      result_desc: resultDesc,
      mpesa_receipt: receipt ?? null,
      raw_callback: body,
    }).eq('id', payment.id);

    if (resultCode === 0) {
      const { data: order } = await supabase.from('orders').select('*').eq('id', payment.order_id).single();
      if (order) {
        await supabase.from('orders').update({ status: 'paid', payment_ref: receipt ?? order.payment_ref }).eq('id', order.id);

        const ref = (order.payment_ref || '').split(':');
        const tierId = ref[0];
        const qty = parseInt(ref[1] || '1', 10);
        if (tierId && qty > 0 && tierId.length === 36) {
          // Insert tickets one-by-one to mint a signed qr_token for each (tid embedded after id known).
          for (let i = 0; i < qty; i++) {
            const { data: t, error } = await supabase.from('tickets').insert({
              order_id: order.id,
              event_id: order.event_id,
              tier_id: tierId,
              holder_name: order.guest_name,
              holder_email: order.guest_email,
            }).select('id').single();
            if (error || !t) continue;

            const header = b64urlEncode({ alg: 'HS256', typ: 'TKT' });
            const payload = b64urlEncode({
              tid: t.id,
              eid: order.event_id,
              iat: Math.floor(Date.now() / 1000),
              nonce: crypto.randomUUID().slice(0, 8),
            });
            const sig = await signToken(`${header}.${payload}`, SECRET);
            const qrToken = `${header}.${payload}.${sig}`;

            await supabase.from('tickets').update({ qr_token: qrToken }).eq('id', t.id);
          }

          const { data: tier } = await supabase.from('ticket_tiers').select('sold').eq('id', tierId).single();
          if (tier) await supabase.from('ticket_tiers').update({ sold: tier.sold + qty }).eq('id', tierId);
        }
      }
    } else {
      await supabase.from('orders').update({ status: 'failed' }).eq('id', payment.order_id);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('mpesa-callback error', err);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Error logged' }), { headers: { 'Content-Type': 'application/json' } });
  }
});
