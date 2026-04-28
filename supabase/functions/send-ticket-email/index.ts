// Generates QR codes for each ticket and (when an email domain is configured)
// sends a styled HTML ticket email. Without a domain, it logs the rendered
// payload so the rest of the flow works end-to-end.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

// Strict CORS allowlist for browser origins
const ALLOWED_ORIGINS = [
  "https://fezzy.app", // production
  "http://localhost:5173", // local dev
];

function getCorsHeaders(origin: string | null) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
  }
  // No CORS for disallowed origins
  return {};
}

interface Body {
  orderId: string;
}

const renderTicketHtml = (params: {
  eventTitle: string;
  date: string;
  venue: string;
  city: string;
  holderName: string;
  tierName: string;
  qrDataUrl: string;
  ref: string;
  accent: string;
}) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Your Fezzy ticket</title></head>
<body style="margin:0;padding:24px;background:#FFF8EE;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0d1b2a">
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;padding:8px 0 24px">
      <span style="display:inline-block;font-weight:800;font-size:22px;letter-spacing:-0.5px">Fezzy <em style="font-style:italic;color:#1FAD66">tickets</em></span>
    </div>
    <div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px -18px rgba(13,27,42,0.18);border:1px solid #ebe2cf">
      <div style="background:linear-gradient(135deg,#1FAD66,#2bd083);padding:28px 28px 22px;color:#fff">
        <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Admit one</p>
        <h1 style="margin:6px 0 0;font-size:26px;line-height:1.15">${params.eventTitle}</h1>
        <p style="margin:6px 0 0;opacity:.9;font-size:13px">${params.date} · ${params.venue}, ${params.city}</p>
      </div>
      <div style="padding:24px 28px;display:flex;gap:24px;align-items:center;justify-content:space-between">
        <div style="flex:1;min-width:0">
          <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280">Holder</p>
          <p style="margin:2px 0 14px;font-weight:700;font-size:16px">${params.holderName}</p>
          <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280">Tier</p>
          <p style="margin:2px 0 14px;font-weight:700;font-size:16px;color:${params.accent}">${params.tierName}</p>
          <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280">Booking ref</p>
          <p style="margin:2px 0 0;font-family:ui-monospace,Menlo,monospace;font-weight:700">${params.ref}</p>
        </div>
        <div style="background:#fff;padding:8px;border-radius:12px;border:1px solid #ebe2cf">
          <img src="${params.qrDataUrl}" width="148" height="148" alt="QR" style="display:block;border-radius:6px"/>
        </div>
      </div>
      <div style="border-top:2px dashed #ebe2cf"></div>
      <div style="padding:18px 28px;background:#FFF8EE;font-size:12px;color:#6b7280;text-align:center">
        Show this QR at the gate. Screenshots work too.
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:#9ca3af;margin:24px 0 0">Fezzy Tickets · Nairobi, Kenya</p>
  </div>
</body></html>`;


Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { orderId } = (await req.json()) as Body;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, events(*), tickets(*, ticket_tiers(*))")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found", detail: orderErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = order.events;
    const accent = event?.ticket_design?.accent ?? "#1FAD66";
    const ref = `FZ-${orderId.slice(0, 8).toUpperCase()}`;
    const dateStr = new Date(event.starts_at).toLocaleString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const renderedTickets: Array<{ ticketId: string; html: string; qrDataUrl: string }> = [];

    for (const ticket of order.tickets) {
      const qrDataUrl = String(await qrcode(ticket.qr_token, { size: 300 }));
      const html = renderTicketHtml({
        eventTitle: event.title,
        date: dateStr,
        venue: event.venue_name ?? "TBA",
        city: event.city ?? "",
        holderName: ticket.holder_name,
        tierName: ticket.ticket_tiers?.name ?? "General",
        qrDataUrl,
        ref,
        accent,
      });
      renderedTickets.push({ ticketId: ticket.id, html, qrDataUrl });
    }

    // Try to send via Lovable Emails if configured; otherwise log payload.
    let delivery: "sent" | "logged" = "logged";
    try {
      const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "ticket-delivery",
          recipientEmail: order.guest_email,
          idempotencyKey: `ticket-${orderId}`,
          templateData: { tickets: renderedTickets, eventTitle: event.title, ref },
        },
      });
      if (!sendErr) delivery = "sent";
    } catch {
      // domain not yet configured — log and continue
    }

    if (delivery === "logged") {
      console.log("[send-ticket-email] No email domain configured. Tickets rendered:", {
        to: order.guest_email,
        ref,
        ticketCount: renderedTickets.length,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, delivery, ref, ticketCount: renderedTickets.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[send-ticket-email] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
