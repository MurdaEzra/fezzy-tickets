// Verifies a Paystack transaction by reference and, on success, marks the
// order paid + creates tickets. Idempotent — safe to call repeatedly while
// the webhook also runs.
import { createClient } from "npm:@supabase/supabase-js@2";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

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
    const status: string = tx.status; // success | failed | abandoned ...
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
  // Update payment row
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

  // Idempotency: only proceed if order is still pending
  const { data: order } = await admin
    .from("orders")
    .select("id, status, event_id, guest_name, guest_email")
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
    const rows = Array.from({ length: quantity }).map(() => ({
      event_id: eventId,
      tier_id: tierId,
      order_id: orderId,
      holder_name: order.guest_name,
      holder_email: order.guest_email,
    }));
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
  if (!apiKey) {
    throw new Error("BREVO_API_KEY not configured");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: "Fezzy Tickets",
        email: "tickets@fezzy.app",
      },
      to: [
        {
          email: recipientEmail,
        },
      ],
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

  if (error || !order) {
    throw new Error("Order not found for ticket delivery");
  }

  const event = order.events;
  if (!event) {
    throw new Error("Order event missing for ticket delivery");
  }

  const accent = event?.ticket_design?.accent ?? "#1FAD66";
  const ref = `FZ-${orderId.slice(0, 8).toUpperCase()}`;
  const dateStr = new Date(event.starts_at).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const ticketHtmls: string[] = [];
  for (const ticket of order.tickets ?? []) {
    const qrDataUrl = String(
      await qrcode(ticket.qr_token, {
        size: 300,
      }),
    );

    ticketHtmls.push(`
      <div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px -18px rgba(13,27,42,.18);border:1px solid #ebe2cf;margin-bottom:24px">
        <div style="background:linear-gradient(135deg,#1FAD66,#2bd083);padding:28px;color:white">
          <p style="margin:0;font-size:11px;text-transform:uppercase">Admit One</p>
          <h1 style="margin:8px 0">${event.title}</h1>
          <p style="margin:0">${dateStr} · ${event.venue_name ?? "TBA"}, ${event.city ?? ""}</p>
        </div>
        <div style="padding:24px;display:flex;justify-content:space-between;gap:24px">
          <div>
            <p><strong>Holder:</strong> ${ticket.holder_name}</p>
            <p><strong>Tier:</strong> <span style="color:${accent}">${ticket.ticket_tiers?.name ?? "General"}</span></p>
            <p><strong>Reference:</strong> ${ref}</p>
          </div>
          <div>
            <img src="${qrDataUrl}" width="150" height="150" alt="QR Code" />
          </div>
        </div>
      </div>
    `);
  }

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Your Fezzy Tickets</title>
</head>
<body style="background:#FFF8EE;padding:24px;font-family:Arial,sans-serif;">
  <div style="max-width:700px;margin:auto;">
    <h1>Your Tickets</h1>
    <p>Thanks for your purchase.</p>
    <p>Booking Reference: <strong>${ref}</strong></p>
    ${ticketHtmls.join("")}
    <p style="color:#777;text-align:center;margin-top:40px;">Show the QR code at the gate. Screenshots are accepted.</p>
  </div>
</body>
</html>`;

  await sendBrevoEmail({
    recipientEmail: order.guest_email,
    subject: `Your Tickets - ${event.title}`,
    htmlContent: emailHtml,
  });
}
