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
    .select("id, status, event_id, guest_name, guest_email, guest_phone, ticket_holders")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "paid") return;

  await admin
    .from("orders")
    .update({ status: "paid", payment_ref: reference })
    .eq("id", orderId);

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
  const ref = `FZ-${orderId.slice(0, 8).toUpperCase()}`;

  // Format start date/time
  const startDate = new Date(event.starts_at);
  const endDate = event.ends_at ? new Date(event.ends_at) : null;

  const formatDateTime = (d: Date) =>
    d.toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const dateStr = endDate
    ? `${formatDateTime(startDate)} – ${formatDateTime(endDate)}`
    : formatDateTime(startDate);

  const orderedOn = new Date(order.created_at ?? Date.now()).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const LOGO_URL =
    "https://ykoxkqiuisbmzfwflmjj.supabase.co/storage/v1/object/public/logo/logo%20(1)-Photoroom.png";

  const ticketHtmls: string[] = [];

  for (const ticket of order.tickets ?? []) {
    const tierName = ticket.ticket_tiers?.name ?? "General";
    const ticketId = ticket.id ?? ref;
    // Upload PNG to storage → get a real HTTPS URL (base64 data URLs are blocked by Gmail/Outlook)
    const qrImageUrl = await uploadQRCode(admin, ticket.qr_token, ticketId);

    ticketHtmls.push(`
      <!-- ═══════════ TICKET CARD ═══════════ -->
      <div style="
        background:#ffffff;
        border:1px solid #e2e8f0;
        border-radius:16px;
        overflow:hidden;
        box-shadow:0 4px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06);
        margin-bottom:32px;
        font-family:'Helvetica Neue',Arial,sans-serif;
      ">

        <!-- Top notice bar — white to accent gradient -->
        <div style="
          background:linear-gradient(90deg,#ffffff 0%,${accent}cc 100%);
          border-bottom:1px solid ${accent}33;
          padding:10px 24px;
          text-align:center;
          font-size:12px;
          color:#1e293b;
          letter-spacing:0.04em;
          font-weight:600;
          text-transform:uppercase;
        ">
          🎟️ &nbsp; Bring this ticket with you to the event
        </div>

        <!-- 3-column body -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>

            <!-- ── Column 1: Event poster background + attendee info ── -->
            <td width="30%" valign="top" style="
              border-right:1px dashed #cbd5e1;
              padding:0;
              vertical-align:top;
            ">
              <!-- Poster image as background — overlaid with dark scrim so text stays readable -->
              <div style="
                position:relative;
                ${event.poster_url || event.image_url || event.cover_image
                  ? `background-image:url('${event.poster_url ?? event.image_url ?? event.cover_image}');
                     background-size:cover;
                     background-position:center top;`
                  : `background:linear-gradient(160deg,#ffffff 0%,${accent} 100%);`
                }
                min-height:200px;
              ">
                <!-- Dark gradient scrim so white text is legible over any photo -->
                <div style="
                  position:absolute;top:0;left:0;right:0;bottom:0;
                  background:linear-gradient(180deg,rgba(0,0,0,0.18) 0%,rgba(0,0,0,0.62) 100%);
                "></div>

                <!-- Text sits on top of the scrim -->
                <div style="position:relative;padding:20px 18px 16px;color:#ffffff;">
                  <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;margin-bottom:6px;">Event</div>
                  <div style="font-size:14px;font-weight:800;line-height:1.3;text-shadow:0 1px 4px rgba(0,0,0,0.4);">${event.title}</div>
                  ${event.city ? `<div style="font-size:11px;margin-top:8px;opacity:0.9;text-shadow:0 1px 3px rgba(0,0,0,0.4);">${event.city}</div>` : ""}
                </div>
              </div>

              <!-- Attendee name + tier — clean white area below poster -->
              <div style="padding:16px 18px 20px;background:#ffffff;">
                <div style="font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:3px;">Name</div>
                <div style="font-size:15px;font-weight:700;color:#1e293b;">${ticket.holder_name}</div>

                <div style="margin-top:12px;">
                  <span style="
                    display:inline-block;
                    background:${accent}1a;
                    color:${accent};
                    border:1px solid ${accent}55;
                    border-radius:20px;
                    padding:4px 14px;
                    font-size:11px;
                    font-weight:700;
                    letter-spacing:0.04em;
                    text-transform:uppercase;
                  ">${tierName}</span>
                </div>
              </div>
            </td>

            <!-- ── Column 2: Event details ── -->
            <td width="44%" valign="top" style="padding:22px 24px;vertical-align:top;background:#ffffff;">

              ${field("Event", `<strong style="font-size:15px;color:#0f172a;">${event.title}</strong>`)}
              ${field("Date &amp; Time", `<span style="color:#1e293b;">${dateStr}</span>`)}
              ${field("Location", `<span style="color:#1e293b;">${[event.venue_name, event.city, event.country].filter(Boolean).join(", ") || "TBA"}</span>`)}
              ${field(
                "Order Info",
                `<span style="color:#1e293b;">Ordered on <strong>${orderedOn}</strong><br>
                 Order ID: <strong>${ref}</strong></span>`,
              )}
              ${field("Ticket ID", `<strong style="font-size:13px;letter-spacing:0.03em;color:#0f172a;">${ticketId}</strong>`)}
              ${field(
                "Ticket Status",
                `<span style="
                  display:inline-block;
                  background:#dcfce7;
                  color:#166534;
                  border:1px solid #bbf7d0;
                  border-radius:6px;
                  padding:3px 12px;
                  font-size:12px;
                  font-weight:700;
                  letter-spacing:0.06em;
                  text-transform:uppercase;
                ">ACTIVE</span>`,
              )}

            </td>

            <!-- ── Column 3: Logo + QR — always white so QR stays scannable ── -->
            <td width="26%" valign="top" style="
              border-left:1px dashed #cbd5e1;
              padding:20px 16px;
              text-align:center;
              vertical-align:top;
              background:#ffffff;
            ">
              <!-- Logo -->
              <div style="margin-bottom:16px;">
                <img src="${LOGO_URL}"
                     alt="Fezzy"
                     width="90"
                     style="max-width:90px;height:auto;display:block;margin:0 auto;" />
              </div>

              <div style="
                font-size:8px;
                letter-spacing:0.14em;
                text-transform:uppercase;
                color:#94a3b8;
                margin-bottom:8px;
              ">Tickets sold through</div>

              <!-- Divider -->
              <div style="border-top:1px dashed #e2e8f0;margin:12px 0;"></div>

              <!-- QR Code -->
              <div style="margin-bottom:8px;">
                <img src="${qrImageUrl}"
                     width="130"
                     height="130"
                     alt="Scan at gate"
                     style="display:block;margin:0 auto;border-radius:8px;border:2px solid #f1f5f9;" />
              </div>
              <div style="font-size:9px;color:#94a3b8;letter-spacing:0.06em;">Scan at gate</div>
            </td>

          </tr>
        </table>

        <!-- Tear line -->
        <div style="
          border-top:1px dashed #cbd5e1;
          margin:0 16px;
          position:relative;
        ">
          <span style="
            position:absolute;left:-16px;top:-9px;
            width:18px;height:18px;
            background:#f8fafc;
            border-radius:50%;
            border:1px solid #e2e8f0;
            display:inline-block;
          "></span>
          <span style="
            position:absolute;right:-16px;top:-9px;
            width:18px;height:18px;
            background:#f8fafc;
            border-radius:50%;
            border:1px solid #e2e8f0;
            display:inline-block;
          "></span>
        </div>

        <!-- Footer strip -->
        <div style="
          background:#f8fafc;
          padding:10px 24px;
          text-align:center;
          font-size:10px;
          color:#94a3b8;
          letter-spacing:0.04em;
        ">
          Once the QR code has been scanned at the gate, it ceases to be valid. &nbsp;·&nbsp; Screenshots are accepted.
        </div>

      </div>
    `);
  }

  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Fezzy Tickets – ${event.title}</title>
</head>
<body style="
  margin:0;padding:0;
  background:#f1f5f9;
  font-family:'Helvetica Neue',Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="700" cellpadding="0" cellspacing="0" border="0" style="max-width:700px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="padding-bottom:28px;text-align:center;">
              <img src="${LOGO_URL}"
                   alt="Fezzy"
                   width="120"
                   style="max-width:120px;height:auto;display:block;margin:0 auto 16px;" />
              <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0f172a;">Your Tickets Are Here! 🎉</h1>
              <p style="margin:0;font-size:14px;color:#64748b;">
                Thanks for your purchase. Your booking reference is
                <strong style="color:#0f172a;">${ref}</strong>.
              </p>
            </td>
          </tr>

          <!-- ── Tickets ── -->
          <tr>
            <td>
              ${ticketHtmls.join("")}
            </td>
          </tr>

          <!-- ── Terms & Support ── -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="
                background:#ffffff;
                border:1px solid #e2e8f0;
                border-radius:12px;
                overflow:hidden;
                margin-bottom:24px;
              ">
                <tr>
                  <!-- Terms -->
                  <td width="55%" valign="top" style="padding:20px 22px;border-right:1px solid #e2e8f0;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#0f172a;margin-bottom:10px;">
                      Terms &amp; Conditions
                    </div>
                    <ul style="margin:0;padding-left:16px;font-size:11px;color:#64748b;line-height:1.7;">
                      <li>Management reserves the right of admission at the event.</li>
                      <li>Only tickets purchased directly through Fezzy are deemed valid.</li>
                      <li>We are not responsible for tickets re-sold through third parties.</li>
                      <li>All sales are final. No cancellations, refunds, or exchanges.</li>
                      <li>You may print your ticket or present it on your mobile phone.</li>
                      <li>Once the QR code is scanned, it ceases to be valid. Keep it safe and do not share it.</li>
                      <li>The ticket holder voluntarily assumes all risks incident to the event.</li>
                    </ul>
                  </td>
                  <!-- Support -->
                  <td width="45%" valign="top" style="padding:20px 22px;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#0f172a;margin-bottom:10px;">
                      Support
                    </div>
                    <div style="font-size:12px;color:#475569;line-height:2;">
                      <div>📧 <a href="mailto:support@fezzytickets.com" style="color:${accent};text-decoration:none;">support@fezzytickets.com</a></div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="text-align:center;padding-top:8px;padding-bottom:32px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                © ${new Date().getFullYear()} Fezzy Tickets &nbsp;·&nbsp; All rights reserved
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendBrevoEmail({
    recipientEmail: order.guest_email,
    subject: `Your Tickets – ${event.title}`,
    htmlContent: emailHtml,
  });

  // ── SMS: send download link to guest's phone ──────────────────────────────
  // The download page lives at /tickets/{orderId} and shows all tickets for the order.
  // Guests can open it on their phone and screenshot/download the PDF.
  const appUrl = Deno.env.get("APP_URL") ?? "https://fezzytickets.com";
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