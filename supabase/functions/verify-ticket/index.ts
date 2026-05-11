import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function verifyToken(token: string, secret: string): Promise<{ tid: string; eid: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'HMAC', key, b64urlToBytes(sig), new TextEncoder().encode(`${header}.${payload}`)
  );
  if (!ok) return null;
  try {
    const obj = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
    if (!obj.tid || !obj.eid) return null;
    return { tid: obj.tid, eid: obj.eid };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ status: 'INVALID', reason: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ status: 'INVALID', reason: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub;

    const { token } = await req.json();
    if (typeof token !== 'string' || token.length < 10) {
      return new Response(JSON.stringify({ status: 'INVALID', reason: 'bad_token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const verified = await verifyToken(token, SECRET);
    if (!verified) {
      return new Response(JSON.stringify({ status: 'INVALID', reason: 'signature' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, SECRET);

    // Authorize: caller must own the event (organizer) or be admin
    const { data: event } = await admin.from('events').select('id, title, organizer_id, starts_at, venue_name').eq('id', verified.eid).single();
    if (!event) {
      return new Response(JSON.stringify({ status: 'INVALID', reason: 'event_not_found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: org } = await admin.from('organizer_profiles').select('id').eq('id', event.organizer_id).eq('user_id', userId).maybeSingle();
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', userId).in('role', ['admin', 'super_admin']).maybeSingle();
    if (!org && !roleRow) {
      return new Response(JSON.stringify({ status: 'INVALID', reason: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: ticket } = await admin.from('tickets').select('id, status, holder_name, checked_in_at, qr_token, event_id').eq('id', verified.tid).single();
    if (!ticket || ticket.qr_token !== token || ticket.event_id !== verified.eid) {
      return new Response(JSON.stringify({ status: 'INVALID', reason: 'not_found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (ticket.status === 'used' || ticket.checked_in_at) {
      return new Response(JSON.stringify({
        status: 'ALREADY_USED',
        ticket: { id: ticket.id, holder: ticket.holder_name, checked_in_at: ticket.checked_in_at, event_title: event.title },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date().toISOString();
    await admin.from('tickets').update({ status: 'used', checked_in_at: now }).eq('id', ticket.id);

    return new Response(JSON.stringify({
      status: 'VALID',
      ticket: { id: ticket.id, holder: ticket.holder_name, checked_in_at: now, event_title: event.title },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('verify-ticket error', err);
    return new Response(JSON.stringify({ status: 'INVALID', reason: 'error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
