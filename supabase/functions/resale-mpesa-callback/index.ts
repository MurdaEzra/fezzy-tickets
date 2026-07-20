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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const listingId = url.searchParams.get("listing_id");
    const reference = url.searchParams.get("ref");

    const payload = await req.json().catch(() => ({}));
    const cb = payload?.Body?.stkCallback;
    const resultCode = Number(cb?.ResultCode ?? -1);
    const items = cb?.CallbackMetadata?.Item ?? [];
    const meta: Record<string, unknown> = {};
    for (const it of items) meta[it.Name] = it.Value;
    const receipt = typeof meta.MpesaReceiptNumber === "string" ? meta.MpesaReceiptNumber : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!listingId || !reference) {
      console.error("[resale-mpesa-callback] Missing listing_id or ref in URL params");
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    if (resultCode !== 0) {
      // Payment failed / cancelled — release the reservation
      console.log(`[resale-mpesa-callback] Payment failed for listing ${listingId}, code=${resultCode}`);
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

      return new Response(JSON.stringify({ ok: true }), { headers: cors });
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

    if (error && !/not finalizable/i.test(error.message ?? "")) {
      console.error("[resale-mpesa-callback] complete_resale_transfer failed:", error);
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
