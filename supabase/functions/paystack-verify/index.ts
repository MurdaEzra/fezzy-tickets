import { createClient } from "npm:@supabase/supabase-js@2";
import QRCode from "npm:qrcode";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
type AdminClient = any;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack not configured" }, 500);

    const { reference } = await req.json();
    if (!reference) return json({ error: "Missing reference" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const data = await res.json();
    if (!res.ok || !data?.status) return json({ error: data?.message ?? "Verify failed" }, 502);

    const tx = data.data;
    const status: string = tx.status;

    // ---- Resale purchase branch --------------------------------------------------
    // Payments started by `resale-initiate-purchase` carry metadata.kind === 'resale'.
    // We must NOT run the regular order/ticket-issuance path — the ticket already
    // exists; we just rotate its qr_token and reassign ownership atomically via the
    // `complete_resale_transfer` RPC.
    if (tx.metadata?.kind === "resale") {
      const listingId = tx.metadata.listing_id as string | undefined;
      if (!listingId) return json({ error: "Listing id missing in metadata" }, 400);

      if (status === "success") {
        await finalizeResale(admin, listingId, reference, tx);
      }
      return json({
        paymentStatus: status === "success" ? "success" : status === "abandoned" ? "pending" : "failed",
        listingId,
        reference,
        resale: true,
      });
    }
    // -----------------------------------------------------------------------------

    const orderId = tx.metadata?.order_id as string | undefined;
    if (!orderId) return json({ error: "Order id missing in metadata" }, 400);

    await finalizeOrder(admin, orderId, reference, status, tx);

    return json({
      paymentStatus: status === "success" ? "success" : status === "abandoned" ? "pending" : "failed",
      orderId,
      reference,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

async function finalizeOrder(
  admin: AdminClient,
  orderId: string,
  reference: string,
  status: string,
  tx: { metadata?: { tier_id?: string; quantity?: number; event_id?: string } },
) {
  await admin
    .from("payments")
    .update({
      status: status === "success" ? "success" : "failed",
      result_desc: status,
      raw_callback: tx as unknown as Record<string, unknown>,
    })
    .eq("paystack_reference", reference);

  if (status !== "success") {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
    return;
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, status, event_id, guest_name, guest_email, guest_phone, ticket_holders, promo_code_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "paid") return;

  await admin
    .from("orders")
    .update({ status: "paid", payment_ref: reference })
    .eq("id", orderId);

  if (order.promo_code_id) {
    const { data: promo } = await admin
      .from("promo_codes")
      .select("used_count")
      .eq("id", order.promo_code_id)
      .maybeSingle();

    if (promo) {
      await admin
        .from("promo_codes")
        .update({ used_count: (promo.used_count ?? 0) + 1 })
        .eq("id", order.promo_code_id);
    }
  }

  const tierId = tx.metadata?.tier_id;
  const quantity = Number(tx.metadata?.quantity ?? 1);
  const eventId = tx.metadata?.event_id ?? order.event_id;

  if (tierId && quantity > 0) {
    const holders = (order.ticket_holders as { name: string; email: string; phone?: string }[] | null) ?? [];
    const rows = Array.from({ length: quantity }).map((_, i) => {
      const holder = holders[i];
      return {
        event_id: eventId,
        tier_id: tierId,
        order_id: orderId,
        holder_name: holder?.name ?? order.guest_name,
        holder_email: holder?.email ?? order.guest_email,
        holder_phone: holder?.phone ?? order.guest_phone ?? null,
      };
    });
    await admin.from("tickets").insert(rows);

    const { data: tier } = await admin
      .from("ticket_tiers")
      .select("sold")
      .eq("id", tierId)
      .maybeSingle();

    if (tier) {
      await admin
        .from("ticket_tiers")
        .update({ sold: (tier.sold ?? 0) + quantity })
        .eq("id", tierId);
    }

    try {
      await sendTicketDelivery(admin, orderId);
    } catch (deliveryError) {
      console.error("[ticket-delivery]", deliveryError);
    }
  }
}

// Finalize a resale purchase:
// 1) Generate a fresh strong qr_token (the buyer's new entry credential).
// 2) Call `complete_resale_transfer` which — atomically inside the DB —
//    rotates the token, bumps qr_token_version, reassigns ownership,
//    marks the listing 'sold', and writes an audit row in resale_transfers
//    that stores ONLY a SHA-256 hash of the previous token.
// 3) Best-effort email the buyer that their ticket is ready.
async function finalizeResale(
  admin: AdminClient,
  listingId: string,
  reference: string,
  tx: { metadata?: Record<string, unknown> },
) {
  // 32 bytes of entropy → 64 hex chars. RPC enforces length >= 16.
  const rand = new Uint8Array(32);
  crypto.getRandomValues(rand);
  const newQrToken = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");

  const { data: transfer, error } = await admin.rpc("complete_resale_transfer", {
    _listing_id: listingId,
    _payment_ref: reference,
    _payment_provider: "paystack",
    _new_qr_token: newQrToken,
  });

  if (error) {
    // Idempotency: a webhook may finalize a listing before the browser reaches
    // /payment/callback. If the listing is already 'sold' the RPC raises
    // "Listing not finalizable" — safe to swallow.
    if (!/not finalizable/i.test(error.message ?? "")) {
      console.error("[resale-finalize] complete_resale_transfer failed:", error);
    }
    return;
  }

  try {
    await notifyResaleBuyer(admin, listingId, transfer);
  } catch (e) {
    console.error("[resale-finalize] buyer email failed:", e);
  }
}

async function notifyResaleBuyer(admin: AdminClient, listingId: string, _transfer: unknown) {
  // Pull public, non-sensitive event + tier info via the safe view.
  const { data: listing } = await admin
    .from("ticket_resale_listings_public")
    .select("event_title, event_starts_at, event_venue_name, event_city, tier_name, resale_price_kes")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!listing) return;

  // Look up the buyer email via auth.users — only the service role can do this.
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

  await sendBrevoEmail({
    recipientEmail: email,
    subject: `Your resale ticket for ${listing.event_title} is ready`,
    htmlContent: html,
  });
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendBrevoSMS({
  recipientPhone,
  message,
}: {
  recipientPhone: string;
  message: string;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");

  // Normalise to E.164. Handles formats from the checkout form:
  //   0712 345 678  →  +254712345678
  //   +254712345678 →  +254712345678  (already correct)
  //   254712345678  →  +254712345678
  let phone = recipientPhone.trim().replace(/[\s\-().]/g, "");
  if (!phone) throw new Error("Empty phone number");

  if (phone.startsWith("0")) {
    // Local Kenyan format: 07xx / 01xx → +2547xx / +2541xx
    phone = "+254" + phone.slice(1);
  } else if (phone.startsWith("254") && !phone.startsWith("+")) {
    phone = "+" + phone;
  } else if (!phone.startsWith("+")) {
    // Unknown format — prepend + and hope for the best
    phone = "+" + phone;
  }

  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: "Fezzy Tickets",       // max 11 alphanumeric chars
      recipient: phone,
      content: message,
      type: "transactional",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo SMS error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

async function sendBrevoEmail({
  recipientEmail,
  subject,
  htmlContent,
}: {
  recipientEmail: string;
  subject: string;
  htmlContent: string;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: "Fezzy Tickets",
        email: "admin@fezzytickets.com",
      },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  return await response.json();
}

async function sendTicketDelivery(admin: AdminClient, orderId: string) {
  const { data: order, error } = await admin
    .from("orders")
    .select(`
      *,
      events(*, ticket_design),
      tickets(
        *,
        ticket_tiers(*)
      )
    `)
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error("Order not found for ticket delivery");

  const event = order.events;
  if (!event) throw new Error("Order event missing for ticket delivery");

  const accent = event?.ticket_design?.accent ?? "#7C3AED";
  let ref = order.payment_ref || order.ref;
  if (!ref) {
    ref = `FZ${orderId.slice(0, 8).toUpperCase()}`;
    // Only save to order.ref if we're generating a fallback, not if we're using payment_ref
    if (!order.ref) {
      await admin.from("orders").update({ ref }).eq("id", orderId);
    }
  }

  const LOGO_URL =
    "https://ykoxkqiuisbmzfwflmjj.supabase.co/storage/v1/object/public/logo/logo%20(1)-Photoroom.png";

  // Use the correct domain for your app (you may want to make this an env var)
  const appUrl = Deno.env.get("APP_URL") ?? "https://fezzytickets.com";
  const ticketLink = `${appUrl}/tickets/${orderId}`;

  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Fezzy Tickets – ${event.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=Great+Vibes&family=Inter:wght@400;500;600;700;800&family=Jost:wght@600;700&display=swap');
  </style>
</head>
<body style="
  margin:0;padding:0;
  background:#f4ede0;
  font-family:'Inter','Montserrat',ui-sans-serif,system-ui,sans-serif;
  font-feature-settings:'ss01','cv11';
  -webkit-font-smoothing:antialiased;
">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="700" cellpadding="0" cellspacing="0" border="0" style="max-width:700px;width:100%;">

          <!-- ── Luxury Header — obsidian card, gold hairline, whisper serif ── -->
          <tr>
            <td style="padding-bottom:24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="
                background:linear-gradient(135deg,#0b0b0d 0%,#171821 55%,#0b0b0d 100%);
                border-radius:20px;
                overflow:hidden;
                box-shadow:0 30px 80px -30px rgba(0,0,0,0.55);
              ">
                <tr>
                  <td style="height:2px;background:linear-gradient(90deg,transparent 0%,#d4a24c 20%,#f5d488 50%,#d4a24c 80%,transparent 100%);"></td>
                </tr>
                <tr>
                  <td style="padding:34px 32px 30px;text-align:center;">
                    <img src="${LOGO_URL}" alt="Fezzy" width="130"
                         style="max-width:130px;height:auto;display:block;margin:0 auto 20px;filter:brightness(0) invert(1);" />
                    <div style="font-family:'Great Vibes',cursive;font-size:34px;color:#34d399;line-height:0.9;margin-bottom:8px;">
                      Fezzy
                    </div>
                    <div style="font-family:'Anton','Arial Narrow','Impact',sans-serif;font-size:14px;letter-spacing:0.42em;color:#10B981;text-transform:uppercase;margin-bottom:10px;">
                      Admit One · Confirmed
                    </div>
                    <h1 style="margin:0 0 8px;font-family:'Anton','Arial Narrow','Impact',sans-serif;font-size:30px;font-weight:400;color:#ffffff;text-transform:uppercase;line-height:1;">
                      Your tickets are ready.
                    </h1>
                    <p style="margin:0;font-size:13px;color:#a9a3a0;line-height:1.6;">
                      Booking reference <strong style="color:#10B981;letter-spacing:0.05em;">${ref}</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="height:1px;background:linear-gradient(90deg,transparent,#1e293b,transparent);"></td>
                </tr>
                <tr>
                  <td style="padding:14px 28px 22px;text-align:center;">
                    <span style="display:inline-block;padding:6px 12px;margin:0 4px 6px;border:1px solid #1e293b;border-radius:999px;font-size:10px;letter-spacing:0.18em;color:#10B981;text-transform:uppercase;font-weight:700;">M-Pesa</span>
                    <span style="display:inline-block;padding:6px 12px;margin:0 4px 6px;border:1px solid #1e293b;border-radius:999px;font-size:10px;letter-spacing:0.18em;color:#10B981;text-transform:uppercase;font-weight:700;">Visa</span>
                    <span style="display:inline-block;padding:6px 12px;margin:0 4px 6px;border:1px solid #1e293b;border-radius:999px;font-size:10px;letter-spacing:0.18em;color:#10B981;text-transform:uppercase;font-weight:700;">Paystack Secured</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── View/Download Tickets Button ── -->
          <tr>
            <td style="text-align:center;">
              <a href="${ticketLink}" style="
                display:inline-block;
                background:linear-gradient(135deg,#10B981 0%,#34d399 100%);
                color:white;
                padding:16px 40px;
                border-radius:999px;
                font-family:'Anton','Arial Narrow','Impact',sans-serif;
                font-size:18px;
                letter-spacing:0.05em;
                text-decoration:none;
                text-transform:uppercase;
                box-shadow:0 10px 25px rgba(16,185,129,0.3);
                margin-bottom:24px;
              ">
                View / Download Tickets
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Send emails to all ticket holders (grouped by email)
  const ticketsByEmail = new Map<string, { name: string }>();
  for (const ticket of order.tickets ?? []) {
    ticketsByEmail.set(ticket.holder_email, { name: ticket.holder_name });
  }
  for (const [recipientEmail] of ticketsByEmail.entries()) {
    await sendBrevoEmail({
      recipientEmail,
      subject: `Your Tickets – ${event.title}`,
      htmlContent: emailHtml,
    });
  }

  // ── SMS: send download link to guest's phone ──────────────────────────────
  const ticketPageUrl = `${appUrl}/tickets/${orderId}`;
  const smsMessage =
    `🎟️ Your ${event.title} ticket is confirmed!\n` +
    `Ref: ${ref}\n` +
    `Download: ${ticketPageUrl}\n` +
    `Show QR at the gate. - Fezzy`;

  if (order.guest_phone) {
    try {
      await sendBrevoSMS({
        recipientPhone: order.guest_phone,
        message: smsMessage,
      });
      console.log("[sms] sent to", order.guest_phone);
    } catch (smsError) {
      // SMS failure must never block ticket delivery
      console.error("[sms] failed:", smsError);
    }
  } else {
    console.log("[sms] skipped — no guest_phone on order");
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a QR code PNG and upload it to Supabase Storage.
 * Returns a public HTTPS URL safe for use in email <img> tags.
 *
 * Uses npm:qrcode's toBuffer() which returns raw PNG bytes directly —
 * no base64 encoding/decoding involved at all.
 */
async function uploadQRCode(
  admin: AdminClient,
  qrToken: string,
  ticketId: string,
): Promise<string> {
  // toBuffer() returns a Node Buffer (Uint8Array-compatible) of raw PNG bytes
  const pngBuffer: Buffer = await QRCode.toBuffer(qrToken, {
    type: "png",
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const path = `tickets/${ticketId}.png`;

  const { error } = await admin.storage
    .from("qrcodes")
    .upload(path, pngBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error("[qr-upload-error]", error.message);
    // Fallback: embed as base64 PNG data URL (may not render in Gmail but won't crash)
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pngBuffer)));
    return `data:image/png;base64,${base64}`;
  }

  const { data } = admin.storage.from("qrcodes").getPublicUrl(path);
  return data.publicUrl;
}

/** Render a label + value row in the details column */
function field(label: string, valueHtml: string): string {
  return `
    <div style="margin-bottom:14px;">
      <div style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px;">${label}</div>
      <div style="font-size:13px;color:#334155;line-height:1.4;">${valueHtml}</div>
    </div>
  `;
}

/** Very simple hex darkener (makes gradient end colour) */
function darken(hex: string): string {
  try {
    const h = hex.replace("#", "");
    const r = Math.max(0, parseInt(h.slice(0, 2), 16) - 40);
    const g = Math.max(0, parseInt(h.slice(2, 4), 16) - 40);
    const b = Math.max(0, parseInt(h.slice(4, 6), 16) - 40);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return hex;
  }
}