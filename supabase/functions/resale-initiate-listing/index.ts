// List a ticket for resale.
// New security model: seller_user_id + current_owner_user_id, no qr_token exposure,
// listing status defaults to 'active', min/max % enforced against tier price.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { ticketId, resalePriceKes } = await req.json();
    if (!ticketId || !resalePriceKes) {
      return json({ error: "ticketId and resalePriceKes are required" }, 400);
    }
    const price = Number(resalePriceKes);
    if (!Number.isFinite(price) || price <= 0) {
      return json({ error: "Invalid resale price" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRes, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);
    const user = userRes.user;

    const { data: ticket, error: ticketErr } = await admin
      .from("tickets")
      .select(`
        id, event_id, current_owner_user_id, checked_in_at, revoked_at, status,
        ticket_tiers(id, name, price_kes),
        events(id, title, starts_at, resale_enabled, min_resale_percentage, max_resale_percentage)
      `)
      .eq("id", ticketId)
      .maybeSingle<any>();

    if (ticketErr || !ticket) return json({ error: "Ticket not found" }, 404);
    if (ticket.current_owner_user_id !== user.id) {
      return json({ error: "You don't own this ticket" }, 403);
    }
    if (ticket.revoked_at || ticket.checked_in_at) {
      return json({ error: "This ticket can't be resold" }, 400);
    }

    const ev = ticket.events;
    if (!ev?.resale_enabled) return json({ error: "Resale is disabled for this event" }, 400);
    if (new Date(ev.starts_at).getTime() <= Date.now()) {
      return json({ error: "Event has already started" }, 400);
    }

    const original = Number(ticket.ticket_tiers?.price_kes ?? 0);
    const min = Math.round(original * ((ev.min_resale_percentage ?? 80) / 100));
    const max = Math.round(original * ((ev.max_resale_percentage ?? 120) / 100));
    if (price < min || price > max) {
      return json({ error: `Price must be between KES ${min} and KES ${max}` }, 400);
    }

    // Reject duplicates.
    const { data: existing } = await admin
      .from("ticket_resale_listings")
      .select("id, status")
      .eq("ticket_id", ticketId)
      .in("status", ["active", "pending_payment"])
      .maybeSingle();
    if (existing) return json({ error: "Ticket is already listed" }, 409);

    const { data: listing, error: insertErr } = await admin
      .from("ticket_resale_listings")
      .insert({
        ticket_id: ticketId,
        event_id: ev.id,
        seller_user_id: user.id,
        resale_price_kes: price,
        status: "active",
      })
      .select("*")
      .single();

    if (insertErr) return json({ error: insertErr.message }, 500);

    return json({ ok: true, listing });
  } catch (err) {
    console.error("[resale-initiate-listing]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
