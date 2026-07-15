// Lightweight polling endpoint for resale purchase status.
// The buyer's frontend polls this after initiating the M-Pesa STK push
// to know when the callback has finalized the transfer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { listingId } = await req.json();
    if (!listingId) return json({ error: "listingId is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await admin.rpc("expire_stale_resale_reservations");

    const { data: listing, error } = await admin
      .from("ticket_resale_listings")
      .select("id, status, payment_ref")
      .eq("id", listingId)
      .maybeSingle();

    if (error || !listing) return json({ error: "Listing not found" }, 404);

    return json({
      listing_id: listing.id,
      status: listing.status,
      finalized: listing.status === "sold",
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
