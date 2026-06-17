import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

const ALLOWED_ORIGINS = [
  "https://fezzytickets.com",
  "http://localhost:8080",
];

const INTERNAL_TICKET_DELIVERY_SECRET = Deno.env.get("INTERNAL_TICKET_DELIVERY_SECRET");

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {};

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization, x-client-info, apikey, content-type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }

  return headers;
}

interface Body {
  orderId: string;
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

  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
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
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  return await response.json();
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
<div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px -18px rgba(13,27,42,.18);border:1px solid #ebe2cf;margin-bottom:24px">
  <div style="background:linear-gradient(135deg,#1FAD66,#2bd083);padding:28px;color:white">
    <p style="margin:0;font-size:11px;text-transform:uppercase">
      Admit One
    </p>

    <h1 style="margin:8px 0">
      ${params.eventTitle}
    </h1>

    <p style="margin:0">
      ${params.date} · ${params.venue}, ${params.city}
    </p>
  </div>

  <div style="padding:24px;display:flex;justify-content:space-between;gap:24px">
    <div>
      <p><strong>Holder:</strong> ${params.holderName}</p>

      <p>
        <strong>Tier:</strong>
        <span style="color:${params.accent}">
          ${params.tierName}
        </span>
      </p>

      <p>
        <strong>Reference:</strong>
        ${params.ref}
      </p>
    </div>

    <div>
      <img
        src="${params.qrDataUrl}"
        width="150"
        height="150"
        alt="QR Code"
      />
    </div>
  </div>
</div>
`;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { orderId } = (await req.json()) as Body;

    if (!orderId) {
      return new Response(
        JSON.stringify({
          error: "orderId required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (INTERNAL_TICKET_DELIVERY_SECRET) {
      const secretHeader = req.headers.get("x-internal-ticket-secret");
      if (secretHeader !== INTERNAL_TICKET_DELIVERY_SECRET) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        events(*),
        tickets(
          *,
          ticket_tiers(*)
        )
      `)
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return new Response(
        JSON.stringify({
          error: "Order not found",
          detail: error?.message,
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const event = order.events;

    const accent =
      event?.ticket_design?.accent ?? "#1FAD66";

    const ref =
      `FZ-${orderId.slice(0, 8).toUpperCase()}`;

    const dateStr = new Date(
      event.starts_at
    ).toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const ticketHtmls: string[] = [];

    const ticketsByEmail = new Map<string, string[]>();
    for (const ticket of order.tickets) {
      const qrDataUrl = String(
        await qrcode(ticket.qr_token, {
          size: 300,
        })
      );

      const ticketHtml = renderTicketHtml({
        eventTitle: event.title,
        date: dateStr,
        venue: event.venue_name ?? "TBA",
        city: event.city ?? "",
        holderName: ticket.holder_name,
        tierName:
          ticket.ticket_tiers?.name ??
          "General",
        qrDataUrl,
        ref,
        accent,
      });

      ticketHtmls.push(ticketHtml);
      const list = ticketsByEmail.get(ticket.holder_email) ?? [];
      list.push(ticketHtml);
      ticketsByEmail.set(ticket.holder_email, list);
    }

    let delivery: "sent" | "failed" = "failed";
    let sentCount = 0;

    for (const [recipientEmail, htmlBlocks] of ticketsByEmail.entries()) {
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Your Fezzy Tickets</title>
</head>

<body
  style="
    background:#FFF8EE;
    padding:24px;
    font-family:Arial,sans-serif;
  "
>
  <div
    style="
      max-width:700px;
      margin:auto;
    "
  >
    <h1>
      Your Ticket${htmlBlocks.length > 1 ? "s" : ""}
    </h1>

    <p>
      Thanks for your purchase.
    </p>

    <p>
      Booking Reference:
      <strong>${ref}</strong>
    </p>

    ${htmlBlocks.join("")}

    <p
      style="
        color:#777;
        text-align:center;
        margin-top:40px;
      "
    >
      Show the QR code at the gate.
      Screenshots are accepted.
    </p>
  </div>
</body>
</html>
`;

      try {
        await sendBrevoEmail({
          recipientEmail,
          subject: `Your Ticket${htmlBlocks.length > 1 ? "s" : ""} - ${event.title}`,
          htmlContent: emailHtml,
        });
        sentCount++;
      } catch (emailError) {
        console.error(
          "[BREVO EMAIL ERROR]",
          recipientEmail,
          emailError
        );
      }
    }

    delivery = sentCount > 0 ? "sent" : "failed";

    return new Response(
      JSON.stringify({
        ok: true,
        delivery,
        ref,
        ticketCount: order.tickets.length,
        emailsSent: sentCount,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "[SEND-TICKET-EMAIL ERROR]",
      error
    );

    return new Response(
      JSON.stringify({
        error: String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});
