// Resale purchase initiation via M-Pesa Daraja STK Push.
// 1. Reserve the listing via `initiate_resale_purchase` RPC (row-locked, 10 min hold).
// 2. Send M-Pesa STK push to the buyer's phone.
// 3. Return checkoutRequestId + customerMessage so the frontend can show status.
//
// The heavy lifting (QR rotation, ownership transfer, audit log) happens in
// `resale-mpesa-callback` once M-Pesa confirms the payment.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUYER_FEE_RATE = 0.035;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeKenyanPhone(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  throw new Error("Enter a valid Kenyan phone number");
}

async function initiateStkPush({
  accountReference,
  amountKes,
  phone,
  callbackUrl,
  description,
}: {
  accountReference: string;
  amountKes: number;
  phone: string;
  callbackUrl: string;
  description: string;
}) {
  const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
  const baseUrl = env === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const shortCode = Deno.env.get("MPESA_SHORTCODE")!;
  const passkey = Deno.env.get("MPESA_PASSKEY")!;
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;

  // Get OAuth token
  const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) throw new Error("M-Pesa auth failed");

  // Build STK push payload
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const password = btoa(`${shortCode}${passkey}${timestamp}`);

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(amountKes)),
    PartyA: phone,
    PartyB: Number(shortCode),
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: description.slice(0, 60),
  };

  const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const stkData = await stkRes.json();
  if (!stkRes.ok) throw new Error(stkData?.errorMessage ?? "STK push failed");
  return stkData;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { listingId, phone } = await req.json();
    if (!listingId) return json({ error: "listingId is required" }, 400);
    if (!phone) return json({ error: "M-Pesa phone number is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authenticate the buyer
    const { data: userRes, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);
    const buyer = userRes.user;

    // Load public listing metadata (safe view — no PII / no qr_token)
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

    // Atomically reserve the listing
    const { data: reserved, error: reserveErr } = await admin.rpc(
      "initiate_resale_purchase",
      {
        _listing_id: listingId,
        _buyer_user_id: buyer.id,
        _expires_minutes: 10,
      },
    );

    if (reserveErr) {
      const msg = reserveErr.message ?? "Unable to reserve listing";
      const status = /own listing/i.test(msg)
        ? 400
        : /not available/i.test(msg)
          ? 409
          : 400;
      return json({ error: msg }, status);
    }
    if (!reserved) return json({ error: "Reservation failed" }, 500);

    // Calculate total with buyer fee
    const resalePrice: number = listing.resale_price_kes;
    const buyerFee = Math.round(resalePrice * BUYER_FEE_RATE);
    const total = resalePrice + buyerFee;

    const reference = `rz_${String(listingId).replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`;

    // Normalize phone
    const normalizedPhone = normalizeKenyanPhone(phone);

    // Build callback URL for M-Pesa
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/resale-mpesa-callback?listing_id=${encodeURIComponent(listingId)}&ref=${encodeURIComponent(reference)}`;

    // Persist reference on the listing
    await admin
      .from("ticket_resale_listings")
      .update({ payment_ref: reference })
      .eq("id", listingId);

    // Initiate STK push
    let stkResult: any = null;
    try {
      stkResult = await initiateStkPush({
        accountReference: reference.slice(0, 12).toUpperCase(),
        amountKes: total,
        phone: normalizedPhone,
        callbackUrl,
        description: `Fezzy resale ${listing.event_title?.slice(0, 30) ?? "ticket"}`,
      });
    } catch (err) {
      // STK push failed — release reservation
      await admin
        .from("ticket_resale_listings")
        .update({
          status: "active",
          buyer_user_id: null,
          reserved_at: null,
          reservation_expires_at: null,
          payment_ref: null,
        })
        .eq("id", listingId)
        .eq("status", "reserved");

      return json({
        error: err instanceof Error ? err.message : "M-Pesa payment initiation failed",
      }, 502);
    }

    return json({
      checkout_request_id: stkResult.CheckoutRequestID ?? null,
      customer_message: stkResult.CustomerMessage ?? "Check your phone to authorize the M-Pesa payment.",
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
