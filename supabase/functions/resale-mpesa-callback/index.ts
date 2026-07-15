// M-Pesa Daraja STK callback for resale purchases.
// On success (ResultCode 0):
//   1. Calls complete_resale_transfer RPC (rotates QR, transfers ownership)
//   2. Sends buyer a notification email
// On failure:
//   Releases the reservation so the listing goes back to active.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

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
    // deno-lint-ignore no-explicit-any
    const meta: Record<string, any> = {};
    for (const it of items) meta[it.Name] = it.Value;
    const receipt = meta.MpesaReceiptNumber ?? null;

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

    // ── Success: finalize the resale transfer ──────────────────────────────

    // Generate a fresh strong qr_token for the buyer
    const rand = new Uint8Array(32);
    crypto.getRandomValues(rand);
    const newQrToken = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");

    // Store M-Pesa receipt on the listing
    await admin
      .from("ticket_resale_listings")
      .update({ payment_ref: reference, mpesa_receipt: receipt })
      .eq("id", listingId);

    // Atomically transfer ownership
    const { error } = await admin.rpc("complete_resale_transfer", {
      _listing_id: listingId,
      _payment_ref: reference,
      _payment_provider: "mpesa",
      _new_qr_token: newQrToken,
    });

    if (error && !/not finalizable/i.test(error.message ?? "")) {
      console.error("[resale-mpesa-callback] complete_resale_transfer failed:", error);
    }

    // Best-effort: notify the buyer
    try {
      await notifyResaleBuyer(admin, listingId);
    } catch (e) {
      console.error("[resale-mpesa-callback] buyer email failed:", e);
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

// deno-lint-ignore no-explicit-any
async function notifyResaleBuyer(admin: any, listingId: string) {
  const { data: listing } = await admin
    .from("ticket_resale_listings_public")
    .select("event_title, event_starts_at, event_venue_name, event_city, tier_name, resale_price_kes")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!listing) return;

  const { data: raw } = await admin
    .from("ticket_resale_listings")
    .select("buyer_user_id")
    .eq("id", listingId)
    .maybeSingle();
  const buyerId = raw?.buyer_user_id;
  if (!buyerId) return;
  const { data: userRes } = await admin.auth.admin.getUserById(buyerId);
  const email = userRes.user?.email;
  if (!email) return;

  const dateStr = listing.event_starts_at
    ? new Date(listing.event_starts_at).toLocaleString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "TBA";

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0b0b0f;font-family:Georgia,'Times New Roman',serif;color:#f5efe1;">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;">
  <div style="border:1px solid #2b241a;background:linear-gradient(135deg,#151009 0%,#0b0b0f 100%);border-radius:24px;padding:40px 32px;">
    <p style="letter-spacing:.28em;font-size:11px;color:#c8a664;margin:0 0 12px;text-transform:uppercase;">Resale · Confirmed</p>
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:34px;line-height:1.1;margin:0 0 20px;color:#f5efe1;">Your ticket is ready.</h1>
    <p style="color:#c9c1b2;font-size:15px;line-height:1.6;margin:0 0 24px;">The ticket for <strong style="color:#f5efe1;">${escapeHtml(listing.event_title ?? "")}</strong> has been transferred to you. Sign in to Fezzy Tickets and open the Tickets tab to reveal your QR code — the previous holder's code no longer works.</p>
    <div style="border:1px solid #2b241a;border-radius:16px;padding:20px 24px;background:rgba(200,166,100,0.06);margin:0 0 28px;">
      <p style="margin:0 0 8px;color:#c8a664;font-size:11px;letter-spacing:.24em;text-transform:uppercase;">${escapeHtml(listing.tier_name ?? "")}</p>
      <p style="margin:0;color:#f5efe1;font-size:17px;">${escapeHtml(listing.event_title ?? "")}</p>
      <p style="margin:6px 0 0;color:#c9c1b2;font-size:13px;">${escapeHtml(dateStr)}</p>
      <p style="margin:6px 0 0;color:#c9c1b2;font-size:13px;">${escapeHtml(listing.event_venue_name ?? "Venue TBA")}, ${escapeHtml(listing.event_city ?? "")}</p>
      <p style="margin:14px 0 0;color:#f5efe1;font-size:15px;">Paid: KES ${Number(listing.resale_price_kes ?? 0).toLocaleString()}</p>
    </div>
    <a href="https://fezzytickets.com/account" style="display:inline-block;background:#c8a664;color:#0b0b0f;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;letter-spacing:.06em;">Open my tickets</a>
    <p style="margin:32px 0 0;color:#7c7566;font-size:11px;line-height:1.6;">Along Karen Rd, Langata · Nairobi, Kenya · +254 728 135 200</p>
  </div>
</div></body></html>`;

  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "Fezzy Tickets", email: "admin@fezzytickets.com" },
      to: [{ email }],
      subject: `Your resale ticket for ${listing.event_title} is ready`,
      htmlContent: html,
    }),
  }).catch(() => {});
}
