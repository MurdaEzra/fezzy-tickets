import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // ✅ Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ Validate env vars
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // =========================
    // USER CLIENT (JWT-based)
    // =========================
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================
    // ADMIN CLIENT (SERVICE ROLE)
    // =========================
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // =========================
    // DELETE ORGANIZER DATA
    // =========================
    const { data: organizerProfiles, error: orgError } = await adminClient
      .from("organizer_profiles")
      .select("id")
      .eq("user_id", user.id);

    if (orgError) throw orgError;

    const organizerIds = (organizerProfiles ?? []).map((p) => p.id);

    if (organizerIds.length > 0) {
      const { data: organizerEvents, error: eventError } = await adminClient
        .from("events")
        .select("id")
        .in("organizer_id", organizerIds);

      if (eventError) throw eventError;

      const eventIds = (organizerEvents ?? []).map((e) => e.id);

      if (eventIds.length > 0) {
        await adminClient.from("tickets").delete().in("event_id", eventIds);
        await adminClient.from("orders").delete().in("event_id", eventIds);
        await adminClient.from("ticket_tiers").delete().in("event_id", eventIds);
        await adminClient.from("events").delete().in("id", eventIds);
      }
    }

    // =========================
    // DELETE USER DATA
    // =========================
    await adminClient.from("orders").delete().eq("user_id", user.id);
    await adminClient
      .from("organizer_profiles")
      .delete()
      .eq("user_id", user.id);
    await adminClient.from("user_roles").delete().eq("user_id", user.id);
    await adminClient.from("profiles").delete().eq("id", user.id);

    // =========================
    // DELETE AUTH USER
    // =========================
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) throw deleteError;

    // =========================
    // SUCCESS RESPONSE
    // =========================
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Delete failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});