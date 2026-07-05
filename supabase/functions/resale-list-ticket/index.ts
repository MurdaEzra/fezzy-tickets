
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
  ticketId: string;
  resalePriceKes: number;
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
