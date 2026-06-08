import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { eventId, tierId, quantity } = await req.json();
    if (!eventId || !tierId || !quantity) {
      return json({ error: 'Missing parameters' }, 400);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers').select('price_kes, event_id').eq('id', tierId).single();
    if (tierError || !tier) return json({ error: 'Tier not found' }, 404);

    const { data: event } = await supabase
      .from('events').select('organizer_id, fee_waived').eq('id', tier.event_id).maybeSingle();
    let feePct = 10;
    if (event) {
      const { data: org } = await supabase
        .from('organizer_profiles').select('fee_locked_pct').eq('id', event.organizer_id).maybeSingle();
      feePct = event.fee_waived ? 0 : (org?.fee_locked_pct ?? 10);
    }

    const price = tier.price_kes;
    const subtotal = price * quantity;
    const fee = Math.round((subtotal * feePct) / 100);
    const total = subtotal; // buyer pays subtotal; fee is split out of organizer's cut

    return json({ price, subtotal, fee, total, feePct });
  } catch (err) {
    return json({ error: 'Internal error', details: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
