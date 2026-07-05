
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
    await completeResalePurchase(supabase, transaction.id, listingId, user.id, listing.ticket_id, listing.seller_id, resalePriceKes, platformFeeKes, event);

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
  event: any
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
}
