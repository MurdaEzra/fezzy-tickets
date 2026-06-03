import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function verifyToken(
  token: string,
  secret: string
): Promise<{ tid: string; eid: string } | null> {
  const parts = token.split('.');

  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['verify']
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlToBytes(sig),
    new TextEncoder().encode(`${header}.${payload}`)
  );

  if (!valid) return null;

  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(b64urlToBytes(payload))
    );

    if (!decoded.tid || !decoded.eid) return null;

    return {
      tid: decoded.tid,
      eid: decoded.eid,
    };
  } catch {
    return null;
  }
}

async function sendBrevoEmail(
  email: string,
  name: string,
  eventTitle: string,
  venue: string | null,
  checkedInAt: string
) {
  const apiKey = Deno.env.get('BREVO_API_KEY');

  if (!apiKey || !email) return;

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: 'Fezzy Tickets',
          email: 'noreply@fezzy.app',
        },
        to: [
          {
            email,
            name,
          },
        ],
        subject: `Check-in Confirmed - ${eventTitle}`,
        htmlContent: `
          <h2>Check-in Successful</h2>

          <p>Hello ${name},</p>

          <p>Your ticket has been successfully checked in.</p>

          <ul>
            <li><strong>Event:</strong> ${eventTitle}</li>
            <li><strong>Venue:</strong> ${venue ?? 'TBA'}</li>
            <li><strong>Time:</strong> ${checkedInAt}</li>
          </ul>

          <p>Enjoy the event.</p>
        `,
      }),
    });
  } catch (err) {
    console.error('Brevo email error', err);
  }
}

async function sendBrevoSMS(
  phone: string,
  eventTitle: string
) {
  const apiKey = Deno.env.get('BREVO_API_KEY');

  if (!apiKey || !phone) return;

  try {
    await fetch(
      'https://api.brevo.com/v3/transactionalSMS/sms',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender: 'EventHub',
          recipient: phone,
          content: `Check-in successful for ${eventTitle}. Enjoy the event.`,
        }),
      }
    );
  } catch (err) {
    console.error('Brevo SMS error', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          status: 'INVALID',
          reason: 'unauthorized',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const SERVICE_ROLE_KEY =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const accessToken = authHeader.replace('Bearer ', '');

    const { data: claims } =
      await userClient.auth.getClaims(accessToken);

    const userId = claims?.claims?.sub;

    if (!userId) {
      return new Response(
        JSON.stringify({
          status: 'INVALID',
          reason: 'unauthorized',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({
          status: 'INVALID',
          reason: 'bad_token',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const verified = await verifyToken(
      token,
      SERVICE_ROLE_KEY
    );

    if (!verified) {
      return new Response(
        JSON.stringify({
          status: 'INVALID',
          reason: 'signature',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      SERVICE_ROLE_KEY
    );

    const { data: event } = await admin
      .from('events')
      .select(
        'id,title,organizer_id,starts_at,venue_name'
      )
      .eq('id', verified.eid)
      .single();

    if (!event) {
      return new Response(
        JSON.stringify({
          status: 'INVALID',
          reason: 'event_not_found',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: organizer } = await admin
      .from('organizer_profiles')
      .select('id')
      .eq('id', event.organizer_id)
      .eq('user_id', userId)
      .maybeSingle();

    const { data: role } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();

    if (!organizer && !role) {
      return new Response(
        JSON.stringify({
          status: 'INVALID',
          reason: 'forbidden',
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: ticket } = await admin
      .from('tickets')
      .select(`
        id,
        event_id,
        qr_token,
        status,
        checked_in_at,
        holder_name,
        holder_email,
        holder_phone
      `)
      .eq('id', verified.tid)
      .single();

    if (
      !ticket ||
      ticket.qr_token !== token ||
      ticket.event_id !== verified.eid
    ) {
      return new Response(
        JSON.stringify({
          status: 'INVALID',
          reason: 'not_found',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (
      ticket.status === 'used' ||
      ticket.checked_in_at
    ) {
      return new Response(
        JSON.stringify({
          status: 'ALREADY_USED',
          ticket: {
            id: ticket.id,
            holder: ticket.holder_name,
            checked_in_at: ticket.checked_in_at,
            event_title: event.title,
          },
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const now = new Date().toISOString();

    await admin
      .from('tickets')
      .update({
        status: 'used',
        checked_in_at: now,
      })
      .eq('id', ticket.id);

    // Send notifications in background
    await Promise.allSettled([
      sendBrevoEmail(
        ticket.holder_email,
        ticket.holder_name,
        event.title,
        event.venue_name,
        now
      ),
      sendBrevoSMS(
        ticket.holder_phone,
        event.title
      ),
    ]);

    return new Response(
      JSON.stringify({
        status: 'VALID',
        ticket: {
          id: ticket.id,
          holder: ticket.holder_name,
          checked_in_at: now,
          event_title: event.title,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('verify-ticket error', err);

    return new Response(
      JSON.stringify({
        status: 'INVALID',
        reason: 'error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

