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
  } = params;

  const dateStr = formatTicketDate(startDate);
  const timeStr = formatTicketTime(startDate);

  // Fezzy Brand Greens
  const greenPrimary = "#10B981"; 
  const greenLight = "#34d399";
  const greenDark = "#047857";
  const darkBg = "#0b0b0d";
  const darkBg2 = "#171821";

  return `
    <!-- ═══════════ CONCERT TICKET TEMPLATE ═══════════ -->
    <div style="
      background:#ffffff;
      border:1px solid #e2e8f0;
      border-radius:8px;
      overflow:hidden;
      box-shadow:0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.05);
      margin:0 auto 32px;
      max-width:680px;
      font-family: 'Inter', 'Montserrat', ui-sans-serif, system-ui, sans-serif;
      font-feature-settings: 'ss01', 'cv11';
      -webkit-font-smoothing: antialiased;
    ">

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">

        <tr>
          <!-- ── MAIN TICKET BODY ── -->
          <td valign="top" style="vertical-align:top;">

            <!-- Dark hero header with cover_image_url backdrop -->
            <div style="
              position:relative;
              background:${darkBg};
              padding:40px 30px;
              color:#ffffff;
              text-align:center;
            ">
              ${posterUrl ? `
                <div style="
                  position:absolute;top:0;left:0;right:0;bottom:0;
                  background-image:url('${posterUrl}');
                  background-size:cover;
                  background-position:center;
                  opacity:0.35;
                "></div>
              ` : ""}

              <div style="position:relative;">
                <!-- ADMIT ONE Header -->
                <div style="
                  font-family: 'Anton', 'Arial Narrow', ui-sans-serif, sans-serif;
                  color:${greenPrimary};
                  padding-bottom: 10px;
                  font-size:18px;
                  letter-spacing: 0;
                  font-weight: 400;
                  text-transform: uppercase;
                  border-bottom: 2px solid ${greenPrimary};
                  display: inline-block;
                  margin-bottom: 24px;
                ">ADMIT ONE</div>

                <!-- Artist / Event name -->
                <div style="
                  font-family: 'Anton', 'Arial Narrow', ui-sans-serif, sans-serif;
                  font-size: 42px;
                  font-weight: 400;
                  line-height: 1;
                  letter-spacing: 0;
                  color:#ffffff;
                  margin-bottom: 12px;
                  text-transform: uppercase;
                  text-shadow:0 3px 10px rgba(0,0,0,0.8);
                ">${eventTitle}</div>

                ${eventCity ? `
                  <div style="
                    font-family: 'Jost', 'Montserrat', ui-sans-serif, sans-serif;
                    font-size: 14px;
                    letter-spacing: -0.035em;
                    line-height: 1;
                    color: ${greenLight};
                    text-transform: uppercase;
                    font-weight: 700;
                  ">${eventCity} · Live Tour</div>
                ` : ""}
              </div>
            </div>

            <!-- INFO GRID — 4 columns: Date / Time / Venue / Section -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; background:#ffffff;">
              <tr>
                <td width="25%" valign="top" style="padding:18px 10px; border-right:1px solid #e2e8f0; text-align:center;">
                  <div style="font-family:'Inter', sans-serif; font-size:9px; letter-spacing:0.15em; color:#94a3b8; text-transform:uppercase; margin-bottom:8px; font-weight:600;">Date</div>
                  <div style="font-family: 'Jost', 'Montserrat', sans-serif; font-size:16px; color:#0f172a; font-weight:700; letter-spacing:-0.035em; line-height:1;">${dateStr}</div>
                </td>
                <td width="20%" valign="top" style="padding:18px 10px; border-right:1px solid #e2e8f0; text-align:center;">
                  <div style="font-family:'Inter', sans-serif; font-size:9px; letter-spacing:0.15em; color:#94a3b8; text-transform:uppercase; margin-bottom:8px; font-weight:600;">Time</div>
                  <div style="font-family: 'Jost', 'Montserrat', sans-serif; font-size:16px; color:#0f172a; font-weight:700; letter-spacing:-0.035em; line-height:1;">${timeStr}</div>
                </td>
                <td width="30%" valign="top" style="padding:18px 10px; border-right:1px solid #e2e8f0; text-align:center;">
                  <div style="font-family:'Inter', sans-serif; font-size:9px; letter-spacing:0.15em; color:#94a3b8; text-transform:uppercase; margin-bottom:8px; font-weight:600;">Venue</div>
                  <div style="font-family: 'Jost', 'Montserrat', sans-serif; font-size:15px; color:#0f172a; font-weight:700; letter-spacing:-0.035em; line-height:1; margin-bottom:3px;">${venueName || "TBA"}</div>
                  <div style="font-family:'Inter', sans-serif; font-size:10px; color:#64748b; letter-spacing:0.05em;">${venueLine}</div>
                </td>
                <td width="25%" valign="top" style="padding:18px 10px; text-align:center;">
                  <div style="font-family:'Inter', sans-serif; font-size:9px; letter-spacing:0.15em; color:#94a3b8; text-transform:uppercase; margin-bottom:8px; font-weight:600;">Section</div>
                  <div style="font-family: 'Jost', 'Montserrat', sans-serif; font-size:16px; color:${greenDark}; font-weight:700; letter-spacing:-0.035em; line-height:1;">${tierName}</div>
                </td>
              </tr>
            </table>
            
            <!-- Order info strip -->
            <div style="
              background:#f8fafc;
              padding:12px 30px;
              text-align:center;
              border-top:1px dashed #cbd5e1;
            ">
              <span style="font-family:'Inter', sans-serif; font-size:10px; color:#64748b; letter-spacing:0.08em; text-transform:uppercase;">
                Holder: <strong style="color:#0f172a;">${holderName}</strong>
                &nbsp;&nbsp;·&nbsp;&nbsp; 
                Order Ref: <strong style="color:#0f172a;">${ref}</strong>
                &nbsp;&nbsp;·&nbsp;&nbsp; 
                Ordered: <strong style="color:#0f172a;">${orderedOn}</strong>
              </span>
            </div>

          </td>

          <!-- ── PERFORATED DIVIDER ── -->
          <td width="1" style="
            background:repeating-linear-gradient(
              to bottom,
              #cbd5e1 0,
              #cbd5e1 4px,
              transparent 4px,
              transparent 10px
            );
            width:2px;
            padding:0;
          "></td>

          <!-- ── TICKET STUB ── -->
          <td width="180" valign="top" style="
            vertical-align:top;
            background:linear-gradient(180deg,${darkBg} 0%,${darkBg2} 100%);
            padding:25px 15px;
            text-align:center;
            color:#ffffff;
          ">
            <div style="font-family: 'Great Vibes', 'Brittany Signature', cursive; font-size: 28px; color: ${greenLight}; font-weight: 400; line-height: 0.9; margin-bottom: 5px;">Fezzy</div>
            <div style="font-family: 'Anton', 'Arial Narrow', sans-serif; font-size:12px; letter-spacing:0.2em; color:${greenPrimary}; text-transform:uppercase; margin-bottom:20px; font-weight:400;">ADMIT ONE</div>
            
            <!-- QR Code -->
            <div style="
              background:#ffffff;
              padding:8px;
              border-radius:4px;
              display:inline-block;
              margin-bottom:12px;
            ">
              <img src="${qrImageUrl}"
                   width="110"
                   height="110"
                   alt="Scan at gate"
                   style="display:block;margin:0 auto;" />
            </div>

            <div style="
              font-family:'Inter', sans-serif;
              font-size:9px;
              letter-spacing:0.15em;
              color:#a9a3a0;
              text-transform:uppercase;
              margin-bottom:15px;
              font-weight:600;
            ">Scan at gate</div>

            <!-- Ticket ID -->
            <div style="
              font-size:9px;
              color:#f1f5f9;
              letter-spacing:0.05em;
              word-break:break-all;
              line-height:1.4;
              font-family:'Courier New',monospace;
              margin-bottom:15px;
            ">${ticketId}</div>

            <!-- Mini date repeat -->
            <div style="
              margin-top:10px;
              padding-top:10px;
              border-top:1px dashed #334155;
            ">
              <div style="font-family:'Inter', sans-serif; font-size:9px; color:#94a3b8; letter-spacing:0.15em; text-transform:uppercase; font-weight:600;">Date</div>
              <div style="font-family: 'Jost', 'Montserrat', sans-serif; font-size:14px; color:${greenPrimary}; letter-spacing:-0.035em; font-weight:700; margin-top:3px; line-height:1;">${dateStr}</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Footer notice -->
      <div style="
        background:${darkBg};
        padding:10px 24px;
        text-align:center;
        font-size:9px;
        color:#a9a3a0;
        letter-spacing:0.15em;
        text-transform:uppercase;
      ">
        Fully Valid Ticket · Screenshots Accepted
      </div>

    </div>
  `;
}

function renderEmailHtml(params: {
  eventTitle: string;
  ref: string;
  holderName: string;
  orderId: string;
}) {
  const {
    eventTitle,
    ref,
    holderName,
    orderId,
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
                ${ref}
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

        <tr>
          <td style="
            padding:14px 28px 22px;
            text-align:center;
          ">

            <span style="
              display:inline-block;
              padding:6px 12px;
              margin:0 4px 6px;
              border:1px solid #1e293b;
              border-radius:999px;
              font-size:10px;
              letter-spacing:.18em;
              color:${greenPrimary};
              text-transform:uppercase;
              font-weight:700;
            ">
              M-Pesa
            </span>

            <span style="
              display:inline-block;
              padding:6px 12px;
              margin:0 4px 6px;
              border:1px solid #1e293b;
              border-radius:999px;
              font-size:10px;
              letter-spacing:.18em;
              color:${greenPrimary};
              text-transform:uppercase;
              font-weight:700;
            ">
              Visa
            </span>

            <span style="
              display:inline-block;
              padding:6px 12px;
              margin:0 4px 6px;
              border:1px solid #1e293b;
              border-radius:999px;
              font-size:10px;
              letter-spacing:.18em;
              color:${greenPrimary};
              text-transform:uppercase;
              font-weight:700;
            ">
              Paystack Secured
            </span>

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

    let ref = order.ref;
    if (!ref) {
      ref = `FZ-${orderId.slice(0, 8).toUpperCase()}`;
      await supabase.from("orders").update({ ref }).eq("id", orderId);
    }

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
