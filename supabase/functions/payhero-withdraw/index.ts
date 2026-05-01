// PayHero withdrawal edge function
// Triggers a B2C/withdrawal request via PayHero and records the result.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAYHERO_USERNAME = Deno.env.get("PAYHERO_USERNAME");
const PAYHERO_PASSWORD = Deno.env.get("PAYHERO_PASSWORD");
const PAYHERO_CHANNEL_ID = Deno.env.get("PAYHERO_CHANNEL_ID");

function basicAuth() {
  return "Basic " + btoa(`${PAYHERO_USERNAME}:${PAYHERO_PASSWORD}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { amount_kes, channel, destination } = body as {
      amount_kes: number;
      channel: "mpesa" | "bank";
      destination: string;
    };

    if (!amount_kes || amount_kes <= 0) {
      return json({ error: "Invalid amount" }, 400);
    }
    if (!["mpesa", "bank"].includes(channel)) {
      return json({ error: "Invalid channel" }, 400);
    }
    if (!destination || destination.trim().length < 4) {
      return json({ error: "Missing destination" }, 400);
    }

    // Find organizer profile
    const { data: org, error: orgErr } = await supabase
      .from("organizer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (orgErr || !org) {
      return json({ error: "Organizer profile not found" }, 404);
    }

    // Create withdrawal record (pending)
    const { data: wd, error: wdErr } = await adminSupabase
      .from("withdrawals")
      .insert({
        organizer_id: org.id,
        amount_kes,
        channel,
        destination,
        status: "processing",
      })
      .select()
      .single();
    if (wdErr) return json({ error: wdErr.message }, 500);

    // Call PayHero (best-effort). Endpoint per PayHero docs: /withdraw
    let payheroRef: string | null = null;
    let failure: string | null = null;
    try {
      if (!PAYHERO_USERNAME || !PAYHERO_PASSWORD) {
        throw new Error("PayHero credentials not configured");
      }

      const payload = channel === "mpesa"
        ? {
          amount: amount_kes,
          phone_number: destination,
          network_code: "63902",
          channel: "mobile",
          channel_id: PAYHERO_CHANNEL_ID ? Number(PAYHERO_CHANNEL_ID) : undefined,
          payment_service: "b2c",
          external_reference: wd.id,
        }
        : {
          amount: amount_kes,
          account_number: destination,
          channel: "bank",
          channel_id: PAYHERO_CHANNEL_ID ? Number(PAYHERO_CHANNEL_ID) : undefined,
          payment_service: "b2b",
          external_reference: wd.id,
        };

      const res = await fetch("https://backend.payhero.co.ke/api/v2/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": basicAuth(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        failure = data?.error_message || data?.message || `PayHero HTTP ${res.status}`;
      } else {
        payheroRef = data?.reference || data?.transaction_id || data?.CheckoutRequestID || null;
      }
    } catch (e) {
      failure = e instanceof Error ? e.message : "Unknown PayHero error";
    }

    await adminSupabase
      .from("withdrawals")
      .update({
        status: failure ? "failed" : "processing",
        payhero_reference: payheroRef,
        failure_reason: failure,
      })
      .eq("id", wd.id);

    return json({
      success: !failure,
      withdrawal_id: wd.id,
      payhero_reference: payheroRef,
      error: failure,
    }, failure ? 502 : 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
