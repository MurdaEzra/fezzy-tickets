// Initialize a Paystack transaction with automatic platform/organizer split.
// Creates the order + payment row, calls Paystack /transaction/initialize with
// the organizer's subaccount, returns authorization_url for the client to redirect to.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack not configured" }, 500);

    const { eventId, tierId, quantity, name, email, phone, callbackUrl } =
      await req.json();
    if (!eventId || !tierId || !quantity || !name || !email) {
      return json({ error: "Missing parameters" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch event + tier + organizer subaccount + fee
    const [{ data: event }, { data: tier }] = await Promise.all([
      admin.from("events").select("id, title, organizer_id, fee_waived").eq("id", eventId).maybeSingle(),
      admin.from("ticket_tiers").select("id, name, price_kes, sold, quantity, event_id").eq("id", tierId).maybeSingle(),
    ]);
    if (!event || !tier || tier.event_id !== event.id) return json({ error: "Invalid event/tier" }, 400);
    if (quantity < 1 || tier.sold + quantity > tier.quantity) {
      return json({ error: "Not enough tickets remaining" }, 400);
    }

    const { data: organizer } = await admin
      .from("organizer_profiles")
      .select("id, paystack_subaccount_code, fee_locked_pct")
      .eq("id", event.organizer_id)
      .maybeSingle();
    if (!organizer) return json({ error: "Organizer not found" }, 400);

    const subtotal = tier.price_kes * quantity;
    const feePct = event.fee_waived ? 0 : (organizer.fee_locked_pct ?? 5);
    const organizerFee = Math.round((subtotal * feePct) / 100);

    // Try to attach the user from the auth header (if any) — not required.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await userClient.auth.getClaims(token);
      userId = data?.claims?.sub ?? null;
    }

    // Create order
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        event_id: eventId,
        user_id: userId,
        guest_name: name,
        guest_email: email,
        guest_phone: phone ?? "",
        subtotal_kes: subtotal,
        total_kes: subtotal,
        organizer_fee_kes: organizerFee,
        fee_waived: event.fee_waived,
        payment_method: "paystack",
        status: "pending",
      })
      .select()
      .single();
    if (orderErr) return json({ error: orderErr.message }, 500);

    const reference = `fz_${order.id.replace(/-/g, "").slice(0, 16)}_${Date.now().toString(36)}`;

    const initBody: Record<string, unknown> = {
      email,
      amount: subtotal * 100, // Paystack works in the lowest currency unit
      currency: "KES",
      reference,
      callback_url: callbackUrl,
      metadata: {
        order_id: order.id,
        event_id: eventId,
        tier_id: tierId,
        quantity,
        custom_fields: [
          { display_name: "Event", variable_name: "event", value: event.title },
          { display_name: "Tickets", variable_name: "tickets", value: `${quantity} × ${tier.name}` },
        ],
      },
    };

    if (organizer.paystack_subaccount_code) {
      initBody.subaccount = organizer.paystack_subaccount_code;
      initBody.bearer = "subaccount"; // organizer bears Paystack fees on their cut
      // organizer's subaccount has percentage_charge set to platform fee
    }

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initBody),
    });
    const data = await res.json();
    if (!res.ok || !data?.status) {
      await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return json({ error: data?.message ?? "Paystack init failed" }, 502);
    }

    // Record pending payment row
    await admin.from("payments").insert({
      order_id: order.id,
      provider: "paystack",
      amount_kes: subtotal,
      phone: phone ?? "",
      status: "pending",
      paystack_reference: reference,
    });

    return json({
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference,
      order_id: order.id,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
