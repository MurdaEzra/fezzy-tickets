import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import QRCode from "npm:qrcode";

const ALLOWED_ORIGINS = [
  "https://fezzytickets.com",
  "http://localhost:8080",
];

const INTERNAL_TICKET_DELIVERY_SECRET = Deno.env.get("INTERNAL_TICKET_DELIVERY_SECRET");

const LOGO_URL =
  "https://res.cloudinary.com/dgfmhyebp/image/upload/v1781945211/logo_2_-Photoroom_ibnhk5.png";

type AdminClient = any;

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

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: "Fezzy Tickets",
        email: "hello@fezzytickets.com",
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

async function uploadQRCode(
  admin: AdminClient,
  qrToken: string,
  ticketId: string,
): Promise<string> {
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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pngBuffer)));
    return `data:image/png;base64,${base64}`;
  }

  const { data } = admin.storage.from("qrcodes").getPublicUrl(path);
  return data.publicUrl;
}

/** Format date into "JAN 16, 2026" style */
function formatTicketDate(d: Date): string {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

/** Format time into "7:30 PM" style */
function formatTicketTime(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function renderTicketCardHtml(params: {
  eventTitle: string;
  eventCity: string;
  posterUrl: string | null;
  startDate: Date;
  endDate: Date | null;
  venueLine: string;
  venueName: string;
  orderedOn: string;
  ref: string;
  holderName: string;
  tierName: string;
  ticketId: string;
  qrImageUrl: string;
  paymentRef: string;
}) {
  const {
    eventTitle,
    eventCity,
    posterUrl,
    startDate,
    endDate,
    venueLine,
    venueName,
    orderedOn,
    ref,
    holderName,
    tierName,
    ticketId,
    qrImageUrl,
    paymentRef,
  } = params;

  const dateStr = formatTicketDate(startDate);
  const timeStr = formatTicketTime(startDate);

  // Fezzy Brand Greens
  const greenPrimary = "#10B981"; 
  const greenLight = "#34d399";
  const greenDark = "#047857";
  const darkBg = "#0b0b0d";
  const darkBg2 = "#171821";

  return
}

function renderEmailHtml(params: {
  eventTitle: string;
  ref: string;
  holderName: string;
  orderId: string;
  paymentRef: string;
}) {
  const {
    eventTitle,
    ref,
    holderName,
    orderId,
    paymentRef,
  } = params;

  const greenPrimary = "#10B981";
  const greenLight = "#34d399";

  // Use the correct domain for your app (you may want to make this an env var)
  const appUrl = Deno.env.get("APP_URL") || "https://fezzytickets.com";
  const ticketLink = `${appUrl}/tickets/${orderId}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Fezzy Tickets – ${eventTitle}</title>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=Great+Vibes&family=Inter:wght@400;500;600;700;800&family=Jost:wght@600;700&display=swap');
  </style>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4ede0;
  font-family:'Inter','Montserrat',ui-sans-serif,system-ui,sans-serif;
  font-feature-settings:'ss01','cv11';
  -webkit-font-smoothing:antialiased;
">

<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:40px 16px;">

<table width="700"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="max-width:700px;width:100%;">

  <!-- Luxury Header -->
  <tr>
    <td style="padding-bottom:24px;">

      <table width="100%"
             cellpadding="0"
             cellspacing="0"
             border="0"
             style="
                background:linear-gradient(
                  135deg,
                  #0b0b0d 0%,
                  #171821 55%,
                  #0b0b0d 100%
                );
                border-radius:20px;
                overflow:hidden;
                box-shadow:0 30px 80px -30px rgba(0,0,0,.55);
             ">

        <tr>
          <td style="
            height:2px;
            background:linear-gradient(
              90deg,
              transparent 0%,
              ${greenPrimary} 20%,
              ${greenLight} 50%,
              ${greenPrimary} 80%,
              transparent 100%
            );
          ">
          </td>
        </tr>

        <tr>
          <td style="padding:34px 32px 30px;text-align:center;">

            <img
              src="${LOGO_URL}"
              alt="Fezzy"
              width="130"
              style="
                max-width:130px;
                height:auto;
                display:block;
                margin:0 auto 20px;
                filter:brightness(0) invert(1);
              "
            />

            <!-- Fezzy Script -->
            <div style="
              font-family:'Great Vibes',cursive;
              font-size:34px;
              color:${greenLight};
              line-height:.9;
              margin-bottom:8px;
            ">
              Fezzy
            </div>

            <div style="
              font-family:'Anton','Arial Narrow','Impact',sans-serif;
              font-size:14px;
              letter-spacing:.42em;
              color:${greenPrimary};
              text-transform:uppercase;
              margin-bottom:14px;
            ">
              Admit One · Confirmed
            </div>

            <h1 style="
              margin:0 0 8px;
              font-family:'Anton','Arial Narrow','Impact',sans-serif;
              font-size:32px;
              font-weight:400;
              color:#ffffff;
              text-transform:uppercase;
              line-height:1;
            ">
              Your tickets are ready.
            </h1>

            <!-- HOLDER NAME NOW USES ANTON -->
            <div style="
              font-family:'Anton','Arial Narrow','Impact',sans-serif;
              font-size:28px;
              font-weight:400;
              color:#ffffff;
              text-transform:uppercase;
              letter-spacing:.02em;
              margin-bottom:10px;
            ">
              ${holderName}
            </div>

            <p style="
              margin:0;
              font-size:13px;
              color:#a9a3a0;
              line-height:1.6;
            ">
              Booking reference
              <strong style="
                color:${greenPrimary};
                letter-spacing:.05em;
              ">
                ${paymentRef}
              </strong>
            </p>

          </td>
        </tr>

        <tr>
          <td style="
            height:1px;
            background:linear-gradient(
              90deg,
              transparent,
              #1e293b,
              transparent
            );
          ">
          </td>
        </tr>

      </table>

    </td>
  </tr>

  <!-- VIEW TICKETS BUTTON -->
  <tr>
    <td style="text-align: center;">
      <a href="${ticketLink}" style="
        display: inline-block;
        background: linear-gradient(135deg, ${greenPrimary} 0%, ${greenLight} 100%);
        color: white;
        padding: 16px 40px;
        border-radius: 999px;
        font-family: 'Anton', 'Arial Narrow', 'Impact', sans-serif;
        font-size: 18px;
        letter-spacing: 0.05em;
        text-decoration: none;
        text-transform: uppercase;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        margin-bottom: 24px;
      ">
        View / Download Tickets
      </a>
    </td>
  </tr>
</table>
</body>
</html>
`;
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orderId } = (await req.json()) as Body;

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (INTERNAL_TICKET_DELIVERY_SECRET) {
      const secretHeader = req.headers.get("x-internal-ticket-secret");
      if (secretHeader !== INTERNAL_TICKET_DELIVERY_SECRET) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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
        JSON.stringify({ error: "Order not found", detail: error?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const event = order.events;

    let ref = order.payment_ref || order.ref;

    // Build tickets by email, but we don't need to render the cards anymore
    const ticketsByEmail = new Map<string, { name: string }>();

    for (const ticket of order.tickets) {
      ticketsByEmail.set(ticket.holder_email, { name: ticket.holder_name });
    }

    let sentCount = 0;

    for (const [recipientEmail, { name: holderName }] of ticketsByEmail.entries()) {
      const emailHtml = renderEmailHtml({
        eventTitle: event.title,
        ref,
        holderName,
        orderId,
        paymentRef: order.payment_ref,
      });

      try {
        await sendBrevoEmail({
          recipientEmail,
          subject: `Your Tickets – ${event.title}`,
          htmlContent: emailHtml,
        });
        sentCount++;
      } catch (emailError) {
        console.error("[BREVO EMAIL ERROR]", recipientEmail, emailError);
      }
    }

    const delivery = sentCount > 0 ? "sent" : "failed";

    return new Response(
      JSON.stringify({
        ok: true,
        delivery,
        ref,
        ticketCount: order.tickets.length,
        emailsSent: sentCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[SEND-TICKET-EMAIL ERROR]", error);

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
