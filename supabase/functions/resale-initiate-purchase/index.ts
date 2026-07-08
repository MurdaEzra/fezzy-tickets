// Resale purchase initiation.
// 1. Reserve the listing via `initiate_resale_purchase` RPC (row-locked, 10 min hold).
// 2. Create a Paystack transaction with metadata { kind: 'resale', listing_id }.
// 3. Return the Paystack authorization_url so the buyer is redirected to checkout.
//
// The heavy lifting (QR rotation, ownership transfer, audit log) happens in
// `complete_resale_transfer` which is invoked from paystack-verify / paystack-webhook
// once the payment is confirmed.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const BUYER_FEE_RATE = 0.035;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Payments not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { listingId, callbackUrl, paymentMethod } = await req.json();
    if (!listingId) return json({ error: "listingId is required" }, 400);

    const method: "card" | "mpesa" =
      paymentMethod === "mpesa" ? "mpesa" : "card";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate the buyer.
    const { data: userRes, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);
    const buyer = userRes.user;
    const buyerEmail = buyer.email ?? "";
    if (!buyerEmail) return json({ error: "Your account has no email" }, 400);

    // Load public listing metadata (safe view — no PII / no qr_token).
    const { data: listing, error: listingErr } = await admin
      .from("ticket_resale_listings_public" as never)
      .select("*")
      .eq("listing_id", listingId)
      .maybeSingle<any>();

    if (listingErr || !listing) return json({ error: "Listing not found" }, 404);
    if (listing.status !== "active") {
      return json({ error: "This listing is no longer available" }, 409);
    }
    if (listing.event_starts_at && new Date(listing.event_starts_at).getTime() <= Date.now()) {
      return json({ error: "Event has already started" }, 409);
    }

    // Atomically reserve the listing. RPC checks ownership, status, and prior expiry.
    const { data: reserved, error: reserveErr } = await admin.rpc(
      "initiate_resale_purchase",
      {
        _listing_id: listingId,
        _buyer_user_id: buyer.id,
        _expires_minutes: 10,
      },
    );

    if (reserveErr) {
      // P0001 = policy error (not available / own listing); P0002 = missing.
      const msg = reserveErr.message ?? "Unable to reserve listing";
      const status = /own listing/i.test(msg)
        ? 400
        : /not available/i.test(msg)
          ? 409
          : 400;
      return json({ error: msg }, status);
    }
    if (!reserved) return json({ error: "Reservation failed" }, 500);

    const resalePrice: number = listing.resale_price_kes;
    const buyerFee = Math.round(resalePrice * BUYER_FEE_RATE);
    const total = resalePrice + buyerFee;

    const reference = `rz_${String(listingId).replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`;

    const initBody: Record<string, unknown> = {
      email: buyerEmail,
      amount: total * 100,
      currency: "KES",
      reference,
      callback_url: callbackUrl,
      metadata: {
        kind: "resale",
        listing_id: listingId,
        buyer_user_id: buyer.id,
        seller_user_id: null, // seller identity hidden from client, resolved server-side
        event_id: listing.event_id,
        resale_price_kes: resalePrice,
        buyer_fee_kes: buyerFee,
        custom_fields: [
          { display_name: "Event", variable_name: "event", value: listing.event_title },
          { display_name: "Ticket", variable_name: "ticket", value: listing.tier_name },
          { display_name: "Type", variable_name: "type", value: "Resale ticket" },
        ],
      },
      customer: { email: buyerEmail, name: buyer.user_metadata?.full_name ?? buyerEmail },
      channels: method === "mpesa" ? ["mobile_money"] : ["card"],
    };

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
      // Best-effort release of the reservation is handled lazily by
      // initiate_resale_purchase / expire_stale_resale_reservations.
      return json({ error: data?.message ?? "Payment gateway rejected the request" }, 502);
    }

    // Persist reference on the listing for later reconciliation.
    await admin
      .from("ticket_resale_listings")
      .update({ payment_ref: reference })
      .eq("id", listingId);

    return json({
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference,
      listing_id: listingId,
      total_kes: total,
      buyer_fee_kes: buyerFee,
    });
  } catch (err) {
    console.error("[resale-initiate-purchase]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
