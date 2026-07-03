import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    let refNo: string | null = null;
    if (req.method === "GET") {
      refNo = new URL(req.url).searchParams.get("ref");
    } else {
      const body = await req.json().catch(() => ({}));
      refNo = body?.refNo ?? null;
    }
    if (!refNo) return new Response(JSON.stringify({ error: "Ref no. required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: plan } = await admin.from("payment_plans").select("*").eq("ref_no", refNo).maybeSingle();
    if (!plan) return new Response(JSON.stringify({ error: "No plan found for that ref no." }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: installments } = await admin
      .from("payment_plan_installments")
      .select("*")
      .eq("plan_id", plan.id)
      .order("sequence", { ascending: true });

    const { data: event } = await admin.from("events").select("id, title, slug, starts_at, venue_name, city, cover_image_url, poster_url").eq("id", plan.event_id).maybeSingle();
    const { data: tier } = await admin.from("ticket_tiers").select("id, name, price_kes").eq("id", plan.tier_id).maybeSingle();

    return new Response(JSON.stringify({ plan, installments: installments ?? [], event, tier }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
