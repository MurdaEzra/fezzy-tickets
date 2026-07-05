
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
  paymentMethod: string;
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

    const { listingId, paymentMethod } = (await req.json()) as Body;

    if (!listingId || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: "listingId and paymentMethod are required" }),
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

    // Get the listing with related data
    const { data: listing, error: listingError } = await supabase
      .from("ticket_resale_listings")
      .select(`
        *,
        tickets(*,
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

    // Check if buyer is not the seller
    if (listing.seller_id === user.id) {
      return new Response(
        JSON.stringify({ error: "You can't buy your own ticket" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Calculate fees and totals
    const event = listing.tickets.events;
    const resalePriceKes = listing.resale_price_kes;
    const platformFeePercentage = event.resale_fee_percentage || 10;
    const platformFeeKes = Math.round(resalePriceKes * (platformFeePercentage / 100));
    const totalAmountKes = resalePriceKes + platformFeeKes;

    // Create transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from("ticket_resale_transactions")
      .insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        ticket_id: listing.ticket_id,
        total_amount_kes: totalAmountKes,
        resale_price_kes: resalePriceKes,
        platform_fee_kes: platformFeeKes,
        payment_method: paymentMethod,
        status: "pending",
      })
      .select("*")
      .single();

    if (transactionError) {
      throw transactionError;
    }

    // For this example, we'll simulate a successful payment.
    // In a real implementation, you would integrate with payment providers here.
    await completeResalePurchase(supabase, transaction.id, listingId, user.id, listing.ticket_id, listing.seller_id, resalePriceKes, platformFeeKes, event, listing);

    return new Response(
      JSON.stringify({
        ok: true,
        transaction,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[RESALE-INITIATE-PURCHASE ERROR]", error);

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

async function completeResalePurchase(
  supabase: any,
  transactionId: string,
  listingId: string,
  buyerId: string,
  ticketId: string,
  sellerId: string,
  resalePriceKes: number,
  platformFeeKes: number,
  event: any,
  listing: any
) {
  // Update transaction status
  await supabase
    .from("ticket_resale_transactions")
    .update({ status: "paid" })
    .eq("id", transactionId);

  // Mark listing as completed
  await supabase
    .from("ticket_resale_listings")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", listingId);

  // Get current ticket data to find previous owner
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*, orders(*)")
    .eq("id", ticketId)
    .single();

  if (!ticket) throw new Error("Ticket not found");

  const previousOwnerId = ticket.orders.user_id;

  // Create new order for the buyer
  const { data: newOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      event_id: event.id,
      user_id: buyerId,
      guest_name: ticket.orders.guest_name,
      guest_email: ticket.orders.guest_email,
      guest_phone: ticket.orders.guest_phone,
      status: "paid",
      total_kes: resalePriceKes + platformFeeKes,
      subtotal_kes: resalePriceKes,
      organizer_fee_kes: 0,
    })
    .select("*")
    .single();

  if (orderError) throw orderError;

  // Generate new QR token
  const newQrToken = crypto.randomUUID();

  // Deactivate old QR token in ticket_qr_versions
  await supabase
    .from("ticket_qr_versions")
    .update({ is_active: false })
    .eq("ticket_id", ticketId);

  // Add new QR version
  await supabase.from("ticket_qr_versions").insert({
    ticket_id: ticketId,
    qr_token: newQrToken,
    owner_id: buyerId,
    is_active: true,
  });

  // Update ticket with new order and QR token
  await supabase
    .from("tickets")
    .update({
      order_id: newOrder.id,
      qr_token: newQrToken,
    })
    .eq("id", ticketId);

  // Create ownership record
  await supabase.from("ticket_ownerships").insert({
    ticket_id: ticketId,
    previous_owner_id: previousOwnerId,
    new_owner_id: buyerId,
    purchase_amount_kes: resalePriceKes,
    purchase_source: "resale_purchase",
    transaction_id: transactionId,
  });

  // Create payout record
  await supabase.from("ticket_payouts").insert({
    seller_id: sellerId,
    transaction_id: transactionId,
    amount_kes: resalePriceKes,
    status: "pending",
  });

  // Log activities
  await supabase.from("ticket_activity_logs").insert([
    {
      ticket_id: ticketId,
      user_id: buyerId,
      action: "purchased_resale_ticket",
      metadata: {
        transaction_id: transactionId,
        listing_id: listingId,
        price_kes: resalePriceKes,
      },
    },
    {
      ticket_id: ticketId,
      user_id: sellerId,
      action: "sold_resale_ticket",
      metadata: {
        transaction_id: transactionId,
        listing_id: listingId,
        price_kes: resalePriceKes,
      },
    },
  ]);

  // Send new ticket to buyer (call send-ticket-email function)
  const internalSecret = Deno.env.get("INTERNAL_TICKET_DELIVERY_SECRET");
  if (internalSecret) {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-ticket-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-ticket-secret": internalSecret,
        },
        body: JSON.stringify({ orderId: newOrder.id }),
      });
    } catch (emailError) {
      console.error("Failed to send ticket email:", emailError);
    }
  }

  // Send email to seller
  const dateStr = new Date(event.starts_at).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const sellerEmailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Your Ticket Has Been Sold</title>
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
    <h1>Ticket Sold!</h1>
    <p>Congratulations! Your ticket for <strong>${event.title}</strong> has been successfully sold.</p>
    
    <div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px -18px rgba(13,27,42,.18);border:1px solid #ebe2cf;margin-bottom:24px;padding:24px">
      <p><strong>Event:</strong> ${event.title}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <p><strong>Ticket Type:</strong> ${listing.tickets.ticket_tiers?.name ?? "General"}</p>
      <p><strong>Resale Price:</strong> KES ${resalePriceKes.toLocaleString()}</p>
      <p><strong>Transaction ID:</strong> ${transactionId}</p>
    </div>

    <p>Your payout is now in progress and will be processed soon.</p>
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
      subject: `Your Ticket for ${event.title} Has Been Sold`,
      htmlContent: sellerEmailHtml,
    });
  } catch (emailError) {
    console.error("[RESALE-PURCHASE SELLER EMAIL ERROR]", emailError);
  }
}
