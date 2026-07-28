// M-Pesa Daraja STK callback for resale purchases.
// On success (ResultCode 0), this records confirmed buyer payment and moves
// the listing to pending_approval. Ownership and QR rotation happen only after
// an admin fraud review in resale-admin-action.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function releaseReservation(admin: any, listingId: string) {
  await admin
    .from("ticket_resale_listings")
    .update({
      status: "active",
      buyer_user_id: null,
      payment_expires_at: null,
      payment_ref: null,
    })
    .eq("id", listingId)
    .eq("status", "pending_payment");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    
    // Read raw text first to avoid Deno's strict Content-Type requirements for req.json()
    // because Safaricom Daraja is known to casually omit application/json.
    const bodyText = await req.text().catch(() => "");
    let payload: any = {};
    if (bodyText) {
      try {
        payload = JSON.parse(bodyText);
      } catch (err) {
        console.error("[resale-mpesa-callback] Invalid JSON payload:", bodyText);
      }
    }
    
    const cb = payload?.Body?.stkCallback;
    const checkoutRequestId = cb?.CheckoutRequestID;
    const resultCode = Number(cb?.ResultCode ?? -1);
    
    // Safaricom Daraja is known for stripping query parameters from callbacks.
    // Try to use Daraja's CheckoutRequestID, fallback to URL parameters if missing.
    const fallbackListingId = url.searchParams.get("listing_id");
    const fallbackReference = url.searchParams.get("ref");
    
    const reference = checkoutRequestId || fallbackReference;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let listingId = fallbackListingId;
    if (!listingId && checkoutRequestId) {
      const { data: dbRes } = await admin
        .from("ticket_resale_listings")
        .select("id")
        .eq("payment_ref", checkoutRequestId)
        .maybeSingle();
      if (dbRes?.id) listingId = dbRes.id;
    }

    if (!listingId || !reference) {
      console.error("[resale-mpesa-callback] Missing listing_id or ref for callback. CheckoutRequestID:", checkoutRequestId);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    const items = cb?.CallbackMetadata?.Item ?? [];
    const meta: Record<string, unknown> = {};
    for (const it of items) meta[it.Name] = it.Value;
    const receipt = typeof meta.MpesaReceiptNumber === "string" ? meta.MpesaReceiptNumber : null;

    if (resultCode !== 0) {
      // Payment failed / cancelled — release the reservation so the buyer can retry.
      console.log(`[resale-mpesa-callback] Payment failed for listing ${listingId}, code=${resultCode}`);
      await releaseReservation(admin, listingId);

      return new Response(JSON.stringify({ ok: true, payment_failed: true }), { headers: cors });
    }

    // Store M-Pesa receipt on the listing
    await admin
      .from("ticket_resale_listings")
      .update({ payment_ref: reference, mpesa_receipt: receipt })
      .eq("id", listingId);

    // Atomically mark the listing paid and pending admin approval.
    const { error } = await admin.rpc("complete_resale_transfer", {
      _listing_id: listingId,
      _payment_ref: reference,
      _payment_provider: "mpesa",
      _new_qr_token: "deferred-until-admin-approval",
    });

    if (error) {
      console.error("[resale-mpesa-callback] complete_resale_transfer failed:", error);
      await releaseReservation(admin, listingId);
      return new Response(JSON.stringify({ ok: false, payment_failed: true, error: error.message }), {
        status: 200,
        headers: cors,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch (err) {
    console.error("[resale-mpesa-callback]", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 200,
      headers: cors,
    });
  }
});
