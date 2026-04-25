import { serve } from 'std/server';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  try {
    const { eventId, tierId, quantity } = await req.json();
    if (!eventId || !tierId || !quantity) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
    }

    // Create Supabase client with service role key
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch tier price from DB
    const { data: tier, error: tierError } = await supabase
      .from('tiers')
      .select('price_kes')
      .eq('id', tierId)
      .single();
    if (tierError || !tier) {
      return new Response(JSON.stringify({ error: 'Tier not found' }), { status: 404 });
    }

    const price = tier.price_kes;
    const subtotal = price * quantity;
    const fee = Math.round(subtotal * 0.05); // 5% fee
    const total = subtotal; // Organizer pays fee, not buyer

    return new Response(JSON.stringify({ price, subtotal, fee, total }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', details: err.message }), { status: 500 });
  }
});
