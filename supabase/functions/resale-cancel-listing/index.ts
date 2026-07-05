
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = [
  "https://fezzytickets.com",
  "http://localhost:8080",
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
  listingId: string;
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

    const { listingId } = (await req.json()) as Body;

    if (!listingId) {
      return new Response(
        JSON.stringify({ error: "listingId is required" }),
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

    // Get user from auth header
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

    // Get the listing
    const { data: listing, error: listingError } = await supabase
      .from("ticket_resale_listings")
      .select(`
        *,
        tickets(
          *,
          orders(*),
          events(*),
          ticket_tiers(*)
        )
      `)
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: "Listing not found" }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if user is the seller
    if (listing.seller_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You don't own this listing" }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if listing is active
    if (listing.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Listing is not active" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Update listing status to cancelled
    const { data: updatedListing, error: updateError } = await supabase
      .from("ticket_resale_listings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", listingId)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log the activity
    await supabase.from("ticket_activity_logs").insert({
      ticket_id: listing.ticket_id,
      user_id: user.id,
      action: "cancelled_resale_listing",
      metadata: {
        listing_id: listingId,
      },
    });

    // Send confirmation email
    const event = listing.tickets.events;
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
<title>Your Resale Listing Has Been Cancelled</title>
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
    <h1>Resale Listing Cancelled</h1>
    <p>Your resale listing for <strong>${event.title}</strong> has been successfully cancelled.</p>
    
    <div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px -18px rgba(13,27,42,.18);border:1px solid #ebe2cf;margin-bottom:24px;padding:24px">
      <p><strong>Event:</strong> ${event.title}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <p><strong>Ticket Type:</strong> ${listing.tickets.ticket_tiers?.name ?? "General"}</p>
      <p><strong>Original Resale Price:</strong> KES ${listing.resale_price_kes.toLocaleString()}</p>
      <p><strong>Listing ID:</strong> ${listingId}</p>
    </div>

    <p>Your ticket is now active again and you can use it for the event or relist it for resale.</p>
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
        recipientEmail: listing.tickets.orders.guest_email,
        subject: `Your Resale Listing for ${event.title} Has Been Cancelled`,
        htmlContent: emailHtml,
      });
    } catch (emailError) {
      console.error("[RESALE-CANCEL-LISTING EMAIL ERROR]", emailError);
    }

    return new Response(
      JSON.stringify({ ok: true, listing: updatedListing }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[RESALE-CANCEL-LISTING ERROR]", error);

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
