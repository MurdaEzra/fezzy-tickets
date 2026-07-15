import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { organizerId, amount } = await req.json();
    if (!organizerId || !amount) return json({ error: "organizerId and amount required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRes, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);
    
    // Check if super admin
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id);
    const hasAdmin = roles?.some(r => r.role === "super_admin" || r.role === "admin");
    
    if (!hasAdmin) return json({ error: "Forbidden: Super Admin only" }, 403);

    // Fetch organizer profile
    const { data: organizer, error: orgError } = await admin
      .from("organizer_profiles")
      .select("*")
      .eq("id", organizerId)
      .single();
      
    if (orgError || !organizer) return json({ error: "Organizer not found" }, 404);

    const method = organizer.payout_method || 'mpesa';
    const targetInfo = method === 'till' ? organizer.mpesa_till : organizer.contact_phone;

    if (!targetInfo) {
      return json({ error: `Organizer missing configuration for ${method}` }, 400);
    }

    // STUB: Actual Daraja integration for B2C or B2B happens here.
    if (method === 'till') {
      console.log(`Initiating M-Pesa B2B payout of KES ${amount} to Till ${targetInfo}`);
    } else {
      console.log(`Initiating M-Pesa B2C payout of KES ${amount} to Phone ${targetInfo}`);
    }

    // Log the payout
    await admin.from("platform_logs").insert({
      level: "info",
      action: "organizer_payout",
      message: `Processed ${method} payout of KES ${amount} to ${organizer.org_name}`,
      metadata: { organizerId, amount, method, targetInfo },
      user_id: userRes.user.id
    });

    return json({ success: true, message: "Payout initiated" });

  } catch (err) {
    console.error("[organizer-payout-action]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
