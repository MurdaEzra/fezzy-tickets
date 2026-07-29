// Lightweight polling endpoint for resale purchase status.
// The buyer's frontend polls this after initiating the M-Pesa STK push
// to know when the callback has finalized the transfer.
//
// Self-healing: if the listing has been pending_payment for > 30s and has a
// payment_ref, we actively query M-Pesa's STK Query API to check whether the
// payment actually succeeded. If it did, we call complete_resale_transfer
// ourselves — so a lost callback no longer blocks the flow.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
async function parseResponseBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getMpesaBaseUrl() {
  const explicitBaseUrl = Deno.env.get("MPESA_BASE_URL")?.trim().replace(/\/+$/, "");
  if (explicitBaseUrl) return explicitBaseUrl;
  const env = Deno.env.get("MPESA_ENV")?.trim().toLowerCase();
  if (env === "live") return "https://api.safaricom.co.ke";
  if (env === "sandbox") return "https://sandbox.safaricom.co.ke";
  return null; // M-Pesa not configured — skip STK query
}

/**
 * Query M-Pesa STK push status using the CheckoutRequestID stored as payment_ref.
 * Returns the ResultCode (0 = success) or null if the query fails / is not configured.
 */
async function queryStkStatus(checkoutRequestId: string): Promise<{ resultCode: number; receipt: string | null } | null> {
  const baseUrl = getMpesaBaseUrl();
  if (!baseUrl) return null;

  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
  const shortCode = Deno.env.get("MPESA_SHORTCODE");
  const passkey = Deno.env.get("MPESA_PASSKEY");
  if (!consumerKey || !consumerSecret || !shortCode || !passkey) return null;

  try {
    // Get OAuth token
    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
    });
    const tokenData = await parseResponseBody(tokenRes);
    if (!tokenRes.ok || !tokenData?.access_token) return null;

    // Build STK query payload
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp =
      `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
    const password = btoa(`${shortCode}${passkey}${timestamp}`);

    const queryRes = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: Number(shortCode),
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });
    const queryData = await parseResponseBody(queryRes);
    if (!queryRes.ok || !queryData) return null;

    const resultCode = Number(queryData.ResultCode ?? -1);
    // ResultDesc for success usually contains the receipt number
    const receipt = typeof queryData.ResultDesc === "string"
      ? (queryData.ResultDesc.match(/[A-Z0-9]{10}/)?.[0] ?? null)
      : null;

    return { resultCode, receipt };
  } catch (err) {
    console.warn("[resale-check-status] STK query failed:", err);
    return null;
  }
}

const STK_QUERY_DELAY_MS = 30_000; // Wait 30s before querying M-Pesa directly

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { listingId } = await req.json();
    if (!listingId) return json({ error: "listingId is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await admin.rpc("expire_stale_resale_reservations");

    const { data: listing, error } = await admin
      .from("ticket_resale_listings")
      .select("id, status, payment_ref, buyer_user_id, updated_at")
      .eq("id", listingId)
      .maybeSingle();

    if (error || !listing) return json({ error: "Listing not found" }, 404);

    // ── Self-healing: STK Query fallback for stale pending_payment ──
    if (
      listing.status === "pending_payment" &&
      listing.payment_ref &&
      listing.buyer_user_id
    ) {
      const updatedAt = new Date(listing.updated_at).getTime();
      const age = Date.now() - updatedAt;

      if (age > STK_QUERY_DELAY_MS) {
        console.log(`[resale-check-status] Listing ${listingId} stale pending_payment (${Math.round(age / 1000)}s). Querying M-Pesa STK status...`);
        const stkResult = await queryStkStatus(listing.payment_ref);

        if (stkResult && stkResult.resultCode === 0) {
          // Payment succeeded but callback never arrived — finalize now
          console.log(`[resale-check-status] STK query confirms payment for listing ${listingId}. Finalizing...`);

          // Store receipt if available
          if (stkResult.receipt) {
            await admin
              .from("ticket_resale_listings")
              .update({ mpesa_receipt: stkResult.receipt })
              .eq("id", listingId);
          }

          const { error: rpcErr } = await admin.rpc("complete_resale_transfer", {
            _listing_id: listingId,
            _payment_ref: listing.payment_ref,
            _payment_provider: "mpesa",
            _new_qr_token: "deferred-until-admin-approval",
          });

          if (rpcErr) {
            console.error(`[resale-check-status] complete_resale_transfer failed for ${listingId}:`, rpcErr);
          } else {
            // Re-read the listing to return the updated status
            const { data: updated } = await admin
              .from("ticket_resale_listings")
              .select("id, status, payment_ref, buyer_user_id")
              .eq("id", listingId)
              .maybeSingle();

            if (updated) {
              return json({
                listing_id: updated.id,
                status: updated.status,
                finalized: updated.status === "sold",
                payment_failed: false,
              });
            }
          }
        } else if (stkResult && stkResult.resultCode !== 0 && stkResult.resultCode !== -1) {
          // Payment explicitly failed/cancelled — release reservation
          console.log(`[resale-check-status] STK query shows payment failed for listing ${listingId} (code=${stkResult.resultCode}). Releasing...`);
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

          return json({
            listing_id: listing.id,
            status: "active",
            finalized: false,
            payment_failed: true,
          });
        }
        // If stkResult is null or resultCode is -1, the query itself failed — fall through
        // to the normal passive response and let the next poll retry.
      }
    }

    const paymentFailed =
      listing.status === "active" &&
      listing.buyer_user_id === null &&
      (listing.payment_ref == null || listing.payment_ref === "");

    return json({
      listing_id: listing.id,
      status: listing.status,
      finalized: listing.status === "sold",
      payment_failed: paymentFailed,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
