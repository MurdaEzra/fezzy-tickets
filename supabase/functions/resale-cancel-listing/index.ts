// Cancel an active resale listing. Only the seller can cancel, and only while
// the listing is still 'active' (a pending_payment reservation must be allowed
// to lapse via the payment_expires_at window before it can be re-listed).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { listingId } = await req.json();
    if (!listingId) return json({ error: "listingId is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRes, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);
    const user = userRes.user;

    const { data: listing, error: fetchErr } = await admin
      .from("ticket_resale_listings")
      .select("id, seller_user_id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (fetchErr || !listing) return json({ error: "Listing not found" }, 404);
    if (listing.seller_user_id !== user.id) return json({ error: "You don't own this listing" }, 403);
    if (listing.status !== "active") {
      return json({ error: "Listing cannot be cancelled in its current state" }, 400);
    }

    const { data: updated, error: updateErr } = await admin
      .from("ticket_resale_listings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", listingId)
      .eq("status", "active") // guard against races with the reserve RPC
      .select("*")
      .maybeSingle();

    if (updateErr) return json({ error: updateErr.message }, 500);
    if (!updated) return json({ error: "Listing state changed — refresh and try again" }, 409);

    return json({ ok: true, listing: updated });
  } catch (err) {
    console.error("[resale-cancel-listing]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
