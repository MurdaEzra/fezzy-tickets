
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = [
  "https://fezzytickets.com",
  "http://localhost:8080",
  "http://localhost:8083",
];

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
  ticketId: string;
  resalePriceKes: number;
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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { ticketId, resalePriceKes } = (await req.json()) as Body;

    if (!ticketId || !resalePriceKes) {
      return new Response(
        JSON.stringify({ error: "ticketId and resalePriceKes are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the user from the auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get ticket and related data
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        *,
        orders(*),
        ticket_tiers(*),
        events(*)
      `)
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket not found" }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if user is the owner
    if (ticket.orders.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You don't own this ticket" }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const event = ticket.events;

    // Check if resale is allowed for this event
    if (!event.allow_resale) {
      return new Response(
        JSON.stringify({ error: "Resale is not allowed for this event" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if event has passed
    const eventStart = new Date(event.starts_at);
    if (new Date() > eventStart) {
      return new Response(
        JSON.stringify({ error: "Event has already started" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if resale window is closed
    const resaleCloseTime = new Date(eventStart);
    resaleCloseTime.setHours(resaleCloseTime.getHours() - (event.resale_close_hours_before_event || 24));
    if (new Date() > resaleCloseTime) {
      return new Response(
        JSON.stringify({ error: "Resale window has closed" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if ticket is already checked in
    if (ticket.checked_in_at) {
      return new Response(
        JSON.stringify({ error: "Ticket has already been checked in" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if ticket is already listed
    const { data: existingListing } = await supabase
      .from("ticket_resale_listings")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("status", "active")
      .single();

    if (existingListing) {
      return new Response(
        JSON.stringify({ error: "Ticket is already listed for resale" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check price limits
    const originalPrice = ticket.ticket_tiers.price_kes;
    const minPrice = originalPrice * (event.min_resale_percentage / 100);
    const maxPrice = originalPrice * (event.max_resale_percentage / 100);

    if (resalePriceKes < minPrice || resalePriceKes > maxPrice) {
      return new Response(
        JSON.stringify({
          error: `Price must be between ${minPrice} and ${maxPrice} KES`,
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

    // Create the listing
    const { data: listing, error: listingError } = await supabase
      .from("ticket_resale_listings")
      .insert({
        ticket_id: ticketId,
        seller_id: user.id,
        resale_price_kes: resalePriceKes,
        status: "active",
      })
      .select("*")
      .single();

    if (listingError) {
      throw listingError;
    }

    // Log the activity
    await supabase.from("ticket_activity_logs").insert({
      ticket_id: ticketId,
      user_id: user.id,
      action: "listed_for_resale",
      metadata: {
        resale_price_kes: resalePriceKes,
        listing_id: listing.id,
      },
    });

    // Send confirmation email
    const dateStr = new Date(event.starts_at).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Your Ticket is Listed for Resale</title>
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
    <h1>Ticket Listed for Resale!</h1>
    <p>Great news! Your ticket for <strong>${event.title}</strong> has been successfully listed for resale.</p>
    
    <div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px -18px rgba(13,27,42,.18);border:1px solid #ebe2cf;margin-bottom:24px;padding:24px">
      <p><strong>Event:</strong> ${event.title}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <p><strong>Ticket Type:</strong> ${ticket.ticket_tiers?.name ?? "General"}</p>
      <p><strong>Resale Price:</strong> KES ${resalePriceKes.toLocaleString()}</p>
      <p><strong>Listing ID:</strong> ${listing.id}</p>
    </div>

    <p>You can manage your resale listing from your Fezzy Tickets account dashboard.</p>
    <p>If you have any questions, feel free to reach out to us!</p>
    <div style="
      border-top: 1px solid #ddd;
      padding-top: 24px;
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #777;
    ">
      <p style="margin: 4px 0;">Along Karen Rd, Langata P.O. BOX 00502-00502, Karen Nairobi, Kenya</p>
      <p style="margin: 4px 0;">Phone: +254728135200</p>
    </div>
  </div>
</body>
</html>
`;

    try {
      await sendBrevoEmail({
        recipientEmail: ticket.orders.guest_email,
        subject: `Your Ticket for ${event.title} is Listed for Resale`,
        htmlContent: emailHtml,
      });
    } catch (emailError) {
      console.error("[RESALE-LIST-TICKET EMAIL ERROR]", emailError);
    }

    return new Response(
      JSON.stringify({ ok: true, listing }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[RESALE-LIST-TICKET ERROR]", error);

    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
