import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const BUYER_FEE_RATE = 0.035;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { eventId, tierId, quantity, promoCode } = await req.json();
    if (!eventId || !tierId || !quantity) {
      return json({ error: 'Missing parameters' }, 400);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers').select('price_kes, event_id, sold, quantity').eq('id', tierId).single();
    if (tierError || !tier) return json({ error: 'Tier not found' }, 404);

    const { data: event } = await supabase
      .from('events').select('id, organizer_id, starts_at, status').eq('id', tier.event_id).maybeSingle();
    if (!event || event.id !== eventId || event.status !== 'published') {
      return json({ error: 'This event is not available for checkout' }, 400);
    }
    if (new Date(event.starts_at).getTime() <= Date.now()) {
      return json({ error: 'Ticket sales are closed for this event' }, 409);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || tier.sold + quantity > tier.quantity) {
      return json({ error: 'Not enough tickets remaining' }, 400);
    }

    let discountPercent = 0;
    let discount = 0;

    if (promoCode) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('id, discount_percent, max_uses, used_count, starts_at, ends_at')
        .eq('event_id', eventId)
        .eq('code', promoCode.trim().toUpperCase())
        .maybeSingle();

      if (promo) {
        const now = new Date();
        const isValid = (!promo.starts_at || new Date(promo.starts_at) <= now) &&
                        (!promo.ends_at || new Date(promo.ends_at) >= now) &&
                        (!promo.max_uses || promo.used_count < promo.max_uses);

        if (isValid) {
          discountPercent = promo.discount_percent;
        }
      }
    }

    const price = tier.price_kes;
    const subtotal = price * quantity;
    discount = discountPercent > 0 ? Math.round(subtotal * (discountPercent / 100)) : 0;
    const discountedSubtotal = subtotal - discount;
    const fee = Math.round(discountedSubtotal * BUYER_FEE_RATE);
    const total = discountedSubtotal + fee;

    return json({
      price,
      subtotal,
      discount,
      discountPercent,
      fee,
      total,
      feePct: 3.5
    });
  } catch (err) {
    return json({ error: 'Internal error', details: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
